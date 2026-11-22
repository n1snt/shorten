import http from 'k6/http';
import { check, fail } from 'k6';
import exec from 'k6/execution';
import { Counter, Gauge, Trend } from 'k6/metrics';

const baseUrl = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const rate = Number(__ENV.RATE || 6000);
const duration = Number(__ENV.DURATION_SECONDS || 60);
const warmup = Number(__ENV.WARMUP_SECONDS || 30);
const seedCount = Number(__ENV.SEED_URLS || 1000);
if (!Number.isInteger(rate) || rate < 30 || rate % 30 !== 0) throw new Error('RATE must be a positive multiple of 30');
if (!Number.isInteger(duration) || duration < 1) throw new Error('DURATION_SECONDS must be a positive integer');
if (!Number.isInteger(warmup) || warmup < 1) throw new Error('WARMUP_SECONDS must be a positive integer');
if (!Number.isInteger(seedCount) || seedCount < 1) throw new Error('SEED_URLS must be a positive integer');

const targets = { redirect: rate * 0.9, create: rate / 30, update: rate / 30, delete: rate / 30 };
const scenarioRates = { redirects: targets.redirect, writes: targets.create };
const startRates = Object.fromEntries(Object.entries(scenarioRates).map(([name, target]) => [name, Math.max(1, Math.floor(target / 10))]));
const redirectVUs = Number(__ENV.REDIRECT_VUS || Math.ceil(targets.redirect * 0.2) + 10);
const writeVUs = Number(__ENV.WRITE_VUS || Math.ceil(targets.create * 0.6) + 10);
for (const [name, value] of Object.entries({ REDIRECT_VUS: redirectVUs, WRITE_VUS: writeVUs })) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
}
const latency = new Trend('api_latency', true);
const started = new Counter('started_iterations');
const deadline = new Gauge('measurement_deadline');
const stopped = new Gauge('measurement_stop');

export const options = {
  maxRedirects: 0,
  setupTimeout: '5m',
  teardownTimeout: '2m',
  scenarios: {
    redirects: {
      executor: 'ramping-arrival-rate', exec: 'redirect',
      startRate: startRates.redirects, timeUnit: '1s', gracefulStop: '20s',
      stages: [{ duration: `${warmup}s`, target: targets.redirect }, { duration: `${duration}s`, target: targets.redirect }],
      preAllocatedVUs: redirectVUs,
    },
    writes: {
      executor: 'ramping-arrival-rate', exec: 'write',
      startRate: startRates.writes, timeUnit: '1s', gracefulStop: '20s',
      stages: [{ duration: `${warmup}s`, target: targets.create }, { duration: `${duration}s`, target: targets.create }],
      preAllocatedVUs: writeVUs,
    },
  },
  thresholds: {
    'checks{phase:steady}': ['rate==1'],
    'checks{phase:warmup}': ['rate>=0'],
    'checks{operation:cleanup}': ['rate==1'],
    'http_req_failed{phase:warmup}': ['rate>=0'],
    dropped_iterations: ['count>=0'],
    ...Object.fromEntries(Object.entries(scenarioRates).flatMap(([scenario, target]) => [
      [`started_iterations{scenario:${scenario},phase:steady}`, [`count>=${target * duration}`]],
      [`started_iterations{scenario:${scenario},phase:warmup}`, ['count>=0']],
    ])),
    ...Object.fromEntries(Object.entries(targets).flatMap(([operation, target]) => [
      [`api_latency{operation:${operation},phase:steady}`, ['p(95)<100']],
      [`http_req_failed{operation:${operation},phase:steady}`, ['rate==0']],
      [`http_reqs{operation:${operation},phase:steady}`, [`count>=${target * duration}`]],
    ])),
  },
};

export function phaseForElapsed(elapsedMs) {
  return elapsedMs < warmup * 1000 ? 'warmup' : 'steady';
}

function beginIteration() {
  if (exec.vu.iterationInScenario === 0) deadline.add(exec.scenario.startTime + (warmup + duration) * 1000);
  // Keep an entire CRUD cycle in the phase in which its iteration started.
  exec.vu.metrics.tags.phase = phaseForElapsed(Date.now() - exec.scenario.startTime);
  started.add(1);
}

export function request(operation, method, path, payload = null,
  expectedStatus = method === 'POST' ? 201 : method === 'GET' ? 302 : 200) {
  const start = Date.now();
  const response = http.request(method, `${baseUrl}${path}`, payload === null ? null : JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    tags: { operation, name: `${method} ${operation}` },
    responseCallback: http.expectedStatuses(expectedStatus),
    timeout: '5s',
  });
  // Include connection setup and client-side waiting, not just HTTP transfer time.
  if (operation in targets) latency.add(Date.now() - start, { operation });
  return response;
}

export function createUrl(originalUrl, operation) {
  const response = request(operation, 'POST', '/api/shorten', { originalUrl });
  let body;
  try { body = response.json(); } catch { body = null; }
  if (!check(body, {
    'URL creation valid': b => response.status === 201 && typeof b?.shortCode === 'string'
      && b.shortCode.length > 0 && b.originalUrl === originalUrl,
  }, { operation })) fail(`URL creation failed: HTTP ${response.status}`);
  return { shortCode: body.shortCode, originalUrl, expiry: body.expiry };
}

export function deleteUrl(shortCode, operation) {
  const response = request(operation, 'DELETE', `/api/shorten/${encodeURIComponent(shortCode)}`);
  const deleted = check(response, { 'URL deleted': r => r.status === 200 }, { operation });
  if (!deleted) {
    console.error(`Failed to delete test URL: ${shortCode}`);
  }
  return deleted;
}

export function setup() {
  const data = { runId: `${Date.now()}-${Math.random()}`, urls: [] };
  try {
    for (let i = 0; i < seedCount; i++) {
      data.urls.push(createUrl(`https://example.com/k6/${data.runId}/seed/${i}`, 'fixture'));
    }
    return data;
  } catch (error) {
    teardown(data);
    throw error;
  }
}

export function redirect({ urls }) {
  beginIteration();
  // shortcut: uniform reads over a small corpus; use a production-sized dataset to test storage scale.
  const url = urls[Math.floor(Math.random() * urls.length)];
  const response = request('redirect', 'GET', `/${encodeURIComponent(url.shortCode)}`);
  check(response, {
    'correct redirect': r => r.status === 302 && r.headers.Location === url.originalUrl,
  }, { operation: 'redirect' });
}

export function write({ runId }) {
  beginIteration();
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
  stopped.add(Date.now());
  for (const url of data?.urls || []) deleteUrl(url.shortCode, 'cleanup');
}

export function handleSummary(data) {
  const counts = Object.fromEntries(Object.keys(targets).map(operation => [operation,
    data.metrics[`http_reqs{operation:${operation},phase:steady}`]?.values.count || 0,
  ]));
  const complete = Object.entries(targets).every(([operation, target]) => counts[operation] >= target * duration);
  const end = data.metrics.measurement_deadline?.values.max || 0;
  const finished = end > 0 && (data.metrics.measurement_stop?.values.value || 0) >= end;
  // Executor drops have no VU phase tag, so detect steady misses from scheduled minus started iterations.
  const missed = Object.entries(scenarioRates).reduce((sum, [scenario, target]) => sum + Math.max(0,
    target * duration - (data.metrics[`started_iterations{scenario:${scenario},phase:steady}`]?.values.count || 0)), 0);
  const dropped = data.metrics.dropped_iterations?.values.count || 0;
  const warmupMissed = Math.max(0, dropped - missed);
  const checkFailures = data.metrics['checks{phase:steady}']?.values.fails || 0;
  const cleanupFailures = data.metrics['checks{operation:cleanup}']?.values.fails || 0;
  let passed = finished && complete && missed === 0 && checkFailures === 0 && cleanupFailures === 0;
  const lines = [
    `Warm-up: ${warmup}s ramp from ~10% to target, using the same VU pools.`,
    `Target: ${rate} API requests/sec for ${duration}s; 90% redirects, 10% CRUD writes.`,
    `Preallocated VUs: ${redirectVUs} redirects, ${writeVUs} writes.`,
    'API | Target RPS | Achieved RPS ≈ | p95 | max | Errors',
    '--- | ---: | ---: | ---: | ---: | ---:',
  ];
  for (const [operation, target] of Object.entries(targets)) {
    const timing = data.metrics[`api_latency{operation:${operation},phase:steady}`]?.values;
    const failures = data.metrics[`http_req_failed{operation:${operation},phase:steady}`]?.values;
    const errors = failures?.rate || 0;
    // For this Rate metric, "passes" counts true samples: failed HTTP requests.
    const failedCount = failures?.passes || 0;
    const rps = finished ? Math.round(counts[operation] / duration) : 'incomplete';
    lines.push(`${operation} | ${target} | ${rps} | ${timing ? timing['p(95)'].toFixed(2) + ' ms' : '-'} | ${timing ? timing.max.toFixed(2) + ' ms' : '-'} | ${failedCount}/${counts[operation]} (${(errors * 100).toFixed(2)}%)`);
    if (!timing || timing['p(95)'] >= 100 || errors > 0 || failedCount > 0) passed = false;
  }
  lines.push('', `Result: ${passed ? 'PASS' : 'FAIL'}; missed steady-state iteration starts: ${missed}.`,
    `Warm-up only: missed starts ≈ ${warmupMissed}, HTTP errors: ${data.metrics['http_req_failed{phase:warmup}']?.values.passes || 0}, failed checks: ${data.metrics['checks{phase:warmup}']?.values.fails || 0}.`,
    `Total k6 dropped iterations (including warm-up): ${dropped}.`);
  if (!finished) lines.push('Incomplete run: no full-window RPS reported.');
  else if (!complete) lines.push('Requested throughput not sustained; achieved RPS shown over the full duration.');
  if (checkFailures || cleanupFailures) lines.push('Steady-state correctness or cleanup checks failed.');
  for (const failed of data.root_group?.checks || []) {
    if (failed.fails) lines.push(`Failed check (all phases): ${failed.name} (${failed.fails}).`);
  }
  lines.push('Steady-state requirement: p95 <100 ms per API, zero errors or missed starts. Max is informational only.',
    `${seedCount} seeded URLs; setup, ramp, and cleanup excluded from API timings. This does not model 1B stored URLs.`);
  return { stdout: lines.join('\n') + '\n' };
}
