import http from 'k6/http';
import { check, fail } from 'k6';
import { Trend } from 'k6/metrics';

const baseUrl = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const rate = Number(__ENV.RATE || 6000);
const duration = Number(__ENV.DURATION_SECONDS || 60);
const seedCount = Number(__ENV.SEED_URLS || 1000);
if (!Number.isInteger(rate) || rate < 30 || rate % 30 !== 0) throw new Error('RATE must be a positive multiple of 30');
if (!Number.isInteger(duration) || duration < 1) throw new Error('DURATION_SECONDS must be a positive integer');
if (!Number.isInteger(seedCount) || seedCount < 1) throw new Error('SEED_URLS must be a positive integer');

const targets = { redirect: rate * 0.9, create: rate / 30, update: rate / 30, delete: rate / 30 };
const latency = new Trend('api_latency', true);

export const options = {
  maxRedirects: 0,
  setupTimeout: '5m',
  teardownTimeout: '2m',
  scenarios: {
    redirects: {
      executor: 'constant-arrival-rate', exec: 'redirect',
      rate: targets.redirect, timeUnit: '1s', duration: `${duration}s`, gracefulStop: '20s',
      preAllocatedVUs: Math.ceil(targets.redirect * 0.1) + 10,
    },
    writes: {
      executor: 'constant-arrival-rate', exec: 'write',
      rate: targets.create, timeUnit: '1s', duration: `${duration}s`, gracefulStop: '20s',
      preAllocatedVUs: Math.ceil(targets.create * 0.3) + 10,
    },
  },
  thresholds: {
    checks: [{ threshold: 'rate==1', abortOnFail: true, delayAbortEval: '10s' }],
    dropped_iterations: ['count==0'],
    'iterations{scenario:redirects}': ['count>=0'],
    'iterations{scenario:writes}': ['count>=0'],
    'dropped_iterations{scenario:redirects}': ['count==0'],
    'dropped_iterations{scenario:writes}': ['count==0'],
    ...Object.fromEntries(Object.entries(targets).flatMap(([operation, target]) => [
      [`api_latency{operation:${operation}}`, ['p(95)<100']],
      [`http_req_failed{operation:${operation}}`, ['rate==0']],
      [`http_reqs{operation:${operation}}`, [`count>=${target * duration}`]],
    ])),
  },
};

function request(operation, method, path, payload = null) {
  const start = Date.now();
  const response = http.request(method, `${baseUrl}${path}`, payload === null ? null : JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    tags: { operation, name: `${method} ${operation}` },
    responseCallback: http.expectedStatuses(method === 'POST' ? 201 : method === 'GET' ? 302 : 200),
    timeout: '5s',
  });
  // Include connection setup and client-side waiting, not just HTTP transfer time.
  if (operation in targets) latency.add(Date.now() - start, { operation });
  return response;
}

function createUrl(originalUrl, operation) {
  const response = request(operation, 'POST', '/api/shorten', { originalUrl });
  let body;
  try { body = response.json(); } catch { body = null; }
  if (!check(body, {
    'URL creation valid': b => response.status === 201 && typeof b?.shortCode === 'string'
      && b.shortCode.length > 0 && b.originalUrl === originalUrl,
  }, { operation })) fail(`URL creation failed: HTTP ${response.status}`);
  return { shortCode: body.shortCode, originalUrl, expiry: body.expiry };
}

function deleteUrl(shortCode, operation) {
  const response = request(operation, 'DELETE', `/api/shorten/${encodeURIComponent(shortCode)}`);
  if (!check(response, { 'URL deleted': r => r.status === 200 }, { operation })) {
    console.error(`Failed to delete test URL: ${shortCode}`);
  }
}

export function setup() {
  const data = { runId: `${Date.now()}-${Math.random()}`, urls: [] };
  try {
    for (let i = 0; i < seedCount; i++) {
      data.urls.push(createUrl(`https://example.com/k6/${data.runId}/seed/${i}`, 'fixture'));
    }
    for (const url of data.urls.slice(0, 100)) {
      const response = request('fixture', 'GET', `/${encodeURIComponent(url.shortCode)}`);
      if (response.status !== 302 || response.headers.Location !== url.originalUrl) fail('Redirect smoke check failed');
    }
    return data;
  } catch (error) {
    teardown(data);
    throw error;
  }
}

export function redirect({ urls }) {
  // shortcut: uniform reads over a small corpus; use a production-sized dataset to test storage scale.
  const url = urls[Math.floor(Math.random() * urls.length)];
  const response = request('redirect', 'GET', `/${encodeURIComponent(url.shortCode)}`);
  check(response, {
    'correct redirect': r => r.status === 302 && r.headers.Location === url.originalUrl,
  }, { operation: 'redirect' });
}

export function write({ runId }) {
  const url = createUrl(`https://example.com/k6/${runId}/write/${__VU}/${__ITER}`, 'create');
  try {
    const expiry = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const response = request('update', 'PATCH', `/api/shorten/${encodeURIComponent(url.shortCode)}`, { expiry });
    let body;
    try { body = response.json(); } catch { body = null; }
    check(body, {
      'URL updated': b => response.status === 200 && b?.shortCode === url.shortCode
        && b.originalUrl === url.originalUrl && Date.parse(b.expiry) > Date.now() && b.expiry !== url.expiry,
    }, { operation: 'update' });
  } finally {
    deleteUrl(url.shortCode, 'delete');
  }
}

export function teardown(data) {
  for (const url of data?.urls || []) deleteUrl(url.shortCode, 'cleanup');
}

export function handleSummary(data) {
  const counts = Object.fromEntries(Object.keys(targets).map(operation => [operation,
    data.metrics[`http_reqs{operation:${operation}}`]?.values.count || 0,
  ]));
  const complete = Object.entries(targets).every(([operation, target]) => counts[operation] >= target * duration);
  const finished = [['redirects', targets.redirect], ['writes', targets.create]].every(([scenario, target]) =>
    (data.metrics[`iterations{scenario:${scenario}}`]?.values.count || 0)
      + (data.metrics[`dropped_iterations{scenario:${scenario}}`]?.values.count || 0) >= target * duration);
  const dropped = data.metrics.dropped_iterations?.values.count || 0;
  let passed = finished && complete && dropped === 0 && !data.metrics.checks?.values.fails;
  const lines = [
    `Target: ${rate} API requests/sec for ${duration}s; 90% redirects, 10% CRUD writes.`,
    'API | Target RPS | Achieved RPS ≈ | p95 | max | Errors',
    '--- | ---: | ---: | ---: | ---: | ---:',
  ];
  for (const [operation, target] of Object.entries(targets)) {
    const timing = data.metrics[`api_latency{operation:${operation}}`]?.values;
    const errors = data.metrics[`http_req_failed{operation:${operation}}`]?.values.rate || 0;
    const rps = finished ? Math.round(counts[operation] / duration) : 'incomplete';
    lines.push(`${operation} | ${target} | ${rps} | ${timing ? timing['p(95)'].toFixed(2) + ' ms' : '-'} | ${timing ? timing.max.toFixed(2) + ' ms' : '-'} | ${(errors * 100).toFixed(2)}%`);
    if (!timing || timing['p(95)'] >= 100 || errors > 0) passed = false;
  }
  lines.push('', `Result: ${passed ? 'PASS' : 'FAIL'}; dropped iterations: ${dropped}.`);
  if (!finished) lines.push('Incomplete run: no full-window RPS reported.');
  else if (!complete) lines.push('Requested throughput not sustained; achieved RPS shown over the full duration.');
  if (data.metrics.checks?.values.fails) lines.push('Correctness or cleanup checks failed.');
  for (const failed of data.root_group?.checks || []) {
    if (failed.fails) lines.push(`Failed check: ${failed.name} (${failed.fails}).`);
  }
  lines.push('Requirement: p95 <100 ms per API, zero errors or dropped iterations. Max is informational only.',
    `${seedCount} seeded URLs; setup/cleanup excluded from API timings. This does not model 1B stored URLs.`);
  return { stdout: lines.join('\n') + '\n' };
}
