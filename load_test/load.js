import http from 'k6/http';
import { check, fail } from 'k6';

const baseUrl = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const redirectStatus = http.expectedStatuses(302);

export const options = {
  maxRedirects: 0,
  scenarios: {
    redirects: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE || 10),
      timeUnit: '1s',
      duration: __ENV.DURATION || '30s',
      preAllocatedVUs: 20,
    },
  },
  thresholds: {
    'http_req_duration{scenario:redirects}': ['p(95)<100'],
    'http_req_failed{scenario:redirects}': ['rate<0.001'],
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
  },
};

export function setup() {
  const originalUrl = `https://example.com/k6/${Date.now()}-${Math.random()}`;
  const response = http.post(
    `${baseUrl}/api/shorten`,
    JSON.stringify({ originalUrl }),
    { headers: { 'Content-Type': 'application/json' }, timeout: '5s' },
  );
  if (response.status !== 201) {
    fail(`Setup: expected 201 creating a URL, got ${response.status}`);
  }
  const body = response.json();
  if (typeof body?.shortCode !== 'string' || !body.shortCode || body.originalUrl !== originalUrl) {
    fail('Setup: expected a shortCode and the originalUrl in the response');
  }
  return { shortCode: body.shortCode, originalUrl };
}

export default function ({ shortCode, originalUrl }) {
  // shortcut: one hot code only; use a seeded dataset to measure broad read traffic.
  const response = http.get(`${baseUrl}/${encodeURIComponent(shortCode)}`, {
    tags: { name: 'GET /{code}' },
    responseCallback: redirectStatus,
    timeout: '5s',
  });
  check(response, {
    'returns 302': (r) => r.status === 302,
    'redirects to original URL': (r) => r.headers.Location === originalUrl,
  });
}
