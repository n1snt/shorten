import { check } from 'k6';
import { createUrl, deleteUrl, request } from './load.js';

export const options = {
  maxRedirects: 0,
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1'], http_req_failed: ['rate==0'] },
};

export default function () {
  const url = createUrl(`https://example.com/k6/${Date.now()}-${Math.random()}/cache`, 'smoke');
  const path = `/${encodeURIComponent(url.shortCode)}`;
  let deleted = false;
  try {
    for (let i = 0; i < 2; i++) {
      check(request('smoke', 'GET', path), {
        'active URL redirects before and after caching': r => r.status === 302 && r.headers.Location === url.originalUrl,
      });
    }

    const expired = request('smoke', 'PATCH', `/api/shorten${path}`, { expiry: '2000-01-01' });
    let body;
    try { body = expired.json(); } catch { body = null; }
    check(body, {
      'expiry update saved': b => expired.status === 200 && b?.shortCode === url.shortCode
        && Date.parse(b.expiry) < Date.now(),
    });
    check(request('smoke', 'GET', path, null, 404), {
      'cached URL stops redirecting after expiry update': r => r.status === 404,
    });

    const expiry = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const restored = request('smoke', 'PATCH', `/api/shorten${path}`, { expiry });
    try { body = restored.json(); } catch { body = null; }
    check(body, {
      'future expiry saved': b => restored.status === 200 && b?.shortCode === url.shortCode
        && Date.parse(b.expiry) > Date.now(),
    });
    check(request('smoke', 'GET', path), {
      'expired URL redirects again after extension': r => r.status === 302 && r.headers.Location === url.originalUrl,
    });

    deleted = deleteUrl(url.shortCode, 'smoke');
    check(request('smoke', 'GET', path, null, 404), {
      'cached URL stops redirecting after deletion': r => r.status === 404,
    });
  } finally {
    if (!deleted) deleteUrl(url.shortCode, 'cleanup');
  }
}
