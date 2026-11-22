import { check } from 'k6';
import { options as loadOptions, handleSummary, phaseForElapsed } from './load.js';

export const options = { vus: 1, iterations: 1, thresholds: { checks: ['rate==1'] } };

export default function () {
  const warmup = Number(__ENV.WARMUP_SECONDS || 30);
  const metrics = {
    'checks{phase:steady}': { values: { fails: 0 } },
    'checks{phase:warmup}': { values: { fails: 0 } },
    'checks{operation:cleanup}': { values: { fails: 0 } },
    'http_req_failed{phase:warmup}': { values: { rate: 0, passes: 0 } },
    dropped_iterations: { values: { count: 0 } },
    measurement_deadline: { values: { max: 90000 } },
    measurement_stop: { values: { value: 90000 } },
  };
  for (const [scenario, target] of Object.entries({ redirects: 5400, writes: 200 })) {
    const warmupCount = Math.floor((loadOptions.scenarios[scenario].startRate + target) * warmup / 2);
    metrics[`started_iterations{scenario:${scenario},phase:steady}`] = { values: { count: target * 60 } };
    metrics[`started_iterations{scenario:${scenario},phase:warmup}`] = { values: { count: warmupCount } };
  }
  for (const [operation, target] of Object.entries({ redirect: 5400, create: 200, update: 200, delete: 200 })) {
    metrics[`http_reqs{operation:${operation},phase:steady}`] = { values: { count: target * 60 } };
    metrics[`api_latency{operation:${operation},phase:steady}`] = { values: { 'p(95)': 20, max: 512 } };
    metrics[`http_req_failed{operation:${operation},phase:steady}`] = { values: { rate: 0, passes: 0, fails: target * 60 } };
  }
  check(loadOptions, {
    'same executor pools ramp then hold the full target for 60 seconds': o =>
      Object.keys(o.scenarios).length === 2 && Object.entries({ redirects: 5400, writes: 200 }).every(([name, target]) => {
        const scenario = o.scenarios[name];
        return scenario.executor === 'ramping-arrival-rate' && scenario.startRate === target / 10
          && scenario.stages[0].duration === `${warmup}s` && scenario.stages[0].target === target
          && scenario.stages[1].duration === '60s' && scenario.stages[1].target === target;
      }),
    'only steady-state APIs have p95 thresholds': o => ['redirect', 'create', 'update', 'delete']
      .every(operation => o.thresholds[`api_latency{operation:${operation},phase:steady}`][0] === 'p(95)<100'),
    'correctness failures do not abort measurement': o => o.thresholds['checks{phase:steady}'][0] === 'rate==1',
    'VU budgets accept overrides': o => o.scenarios.redirects.preAllocatedVUs === Number(__ENV.REDIRECT_VUS || 1090)
      && o.scenarios.writes.preAllocatedVUs === Number(__ENV.WRITE_VUS || 130),
    'warm-up drops do not directly fail steady state': o => o.thresholds.dropped_iterations[0] === 'count>=0'
      && o.thresholds['started_iterations{scenario:redirects,phase:steady}'][0] === 'count>=324000',
  });
  check(null, {
    'phase switches exactly at the ramp boundary': () => phaseForElapsed(warmup * 1000 - 1) === 'warmup'
      && phaseForElapsed(warmup * 1000) === 'steady',
  });
  check(handleSummary({ metrics }).stdout, {
    'prints only measured RPS and latency': text => text.includes('redirect | 5400 | 5400 | 20.00 ms | 512.00 ms | 0/324000 (0.00%)'),
    'passes when p95 meets target despite max exceeding 100 ms': text => text.includes('Result: PASS'),
  });
  metrics['started_iterations{scenario:redirects,phase:warmup}'].values.count -= 2;
  check(handleSummary({ metrics }).stdout, {
    'ramp boundary rounding does not mark a complete steady window incomplete': text => text.includes('Result: PASS')
      && !text.includes('Incomplete run'),
  });
  metrics['started_iterations{scenario:redirects,phase:warmup}'].values.count += 2;

  metrics.dropped_iterations.values.count = 100;
  metrics['started_iterations{scenario:redirects,phase:warmup}'].values.count -= 100;
  metrics['http_req_failed{phase:warmup}'].values = { rate: 0.1, passes: 20 };
  metrics['checks{phase:warmup}'].values.fails = 2;
  metrics['api_latency{operation:redirect,phase:warmup}'] = { values: { 'p(95)': 5000, max: 5000 } };
  check(handleSummary({ metrics }).stdout, {
    'warm-up failures and drops are separate from passing measured traffic': text => text.includes('Result: PASS')
      && text.includes('Warm-up only: missed starts ≈ 100, HTTP errors: 20, failed checks: 2.') && !text.includes('5000.00 ms'),
  });
  metrics['http_req_failed{operation:redirect,phase:steady}'].values = { rate: 2 / 324000, passes: 2, fails: 323998 };
  check(handleSummary({ metrics }).stdout, {
    'exact measured failure counts survive percentage rounding': text => text.includes('2/324000 (0.00%)') && text.includes('Result: FAIL'),
  });
  metrics['http_req_failed{operation:redirect,phase:steady}'].values = { rate: 0, passes: 0, fails: 324000 };
  metrics['checks{phase:steady}'].values.fails = 1;
  check(handleSummary({ metrics }).stdout, {
    'fails incorrect measured responses': text => text.includes('Result: FAIL') && text.includes('Steady-state correctness'),
  });
  metrics['checks{phase:steady}'].values.fails = 0;
  metrics['checks{operation:cleanup}'].values.fails = 1;
  check(handleSummary({ metrics }).stdout, {
    'cleanup failures still fail the run': text => text.includes('Result: FAIL'),
  });
  metrics['checks{operation:cleanup}'].values.fails = 0;
  metrics['api_latency{operation:update,phase:steady}'].values['p(95)'] = 100;
  check(handleSummary({ metrics }).stdout, {
    'fails measured p95 at 100 ms': text => text.includes('Result: FAIL'),
  });
  metrics['api_latency{operation:update,phase:steady}'].values['p(95)'] = 20;
  metrics['started_iterations{scenario:redirects,phase:steady}'].values.count -= 1;
  check(handleSummary({ metrics }).stdout, {
    'a missed steady-state start fails even with warm-up requests present': text =>
      text.includes('Result: FAIL; missed steady-state iteration starts: 1.'),
  });
  metrics['started_iterations{scenario:redirects,phase:steady}'].values.count += 1;
  metrics['http_reqs{operation:create,phase:steady}'].values.count = 1;
  check(handleSummary({ metrics }).stdout, {
    'full-duration throughput shortfalls fail without hiding achieved RPS': text =>
      text.includes('create | 200 | 0 |') && text.includes('Requested throughput not sustained') && text.includes('Result: FAIL'),
  });
  metrics.measurement_stop.values.value = 80000;
  check(handleSummary({ metrics }).stdout, {
    'partial runs do not invent steady-state RPS': text => text.includes('create | 200 | incomplete') && text.includes('Result: FAIL'),
  });
}
