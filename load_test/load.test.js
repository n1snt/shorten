import { check } from 'k6';
import { options as loadOptions, handleSummary } from './load.js';

export const options = { vus: 1, iterations: 1, thresholds: { checks: ['rate==1'] } };

export default function () {
  const metrics = { checks: { values: { fails: 0 } }, dropped_iterations: { values: { count: 0 } } };
  metrics['iterations{scenario:redirects}'] = { values: { count: 5400 * 60 } };
  metrics['iterations{scenario:writes}'] = { values: { count: 200 * 60 } };
  for (const [operation, target] of Object.entries({ redirect: 5400, create: 200, update: 200, delete: 200 })) {
    metrics[`http_reqs{operation:${operation}}`] = { values: { count: target * 60 } };
    metrics[`api_latency{operation:${operation}}`] = { values: { 'p(95)': 20, max: 512 } };
    metrics[`http_req_failed{operation:${operation}}`] = { values: { rate: 0 } };
  }
  check(loadOptions, {
    'fixed-rate workload totals 6000 API requests/sec': o => o.scenarios.redirects.rate === 5400
      && o.scenarios.writes.rate === 200 && o.scenarios.writes.executor === 'constant-arrival-rate',
    'all APIs require p95 below 100 ms': o => ['redirect', 'create', 'update', 'delete']
      .every(operation => o.thresholds[`api_latency{operation:${operation}}`][0] === 'p(95)<100'),
  });
  check(handleSummary({ metrics }).stdout, {
    'prints per-API RPS and latency': text => text.includes('redirect | 5400 | 5400 | 20.00 ms | 512.00 ms | 0.00%'),
    'passes when p95 meets target despite max exceeding 100 ms': text => text.includes('Result: PASS'),
  });
  metrics['api_latency{operation:update}'].values['p(95)'] = 100;
  check(handleSummary({ metrics }).stdout, {
    'fails when any API p95 reaches 100 ms': text => text.includes('Result: FAIL'),
  });
  metrics['api_latency{operation:update}'].values['p(95)'] = 20;
  metrics.dropped_iterations.values.count = 1;
  check(handleSummary({ metrics }).stdout, {
    'fails dropped iterations': text => text.includes('Result: FAIL'),
  });
  metrics.dropped_iterations.values.count = 0;
  metrics['http_reqs{operation:create}'].values.count = 1;
  check(handleSummary({ metrics }).stdout, {
    'shows achieved RPS when the full run misses its target': text => text.includes('create | 200 | 0 |')
      && text.includes('Requested throughput not sustained') && text.includes('Result: FAIL'),
  });
  metrics['iterations{scenario:redirects}'].values.count = 100;
  metrics['iterations{scenario:writes}'].values.count = 1;
  check(handleSummary({ metrics }).stdout, {
    'marks partial workloads instead of inventing RPS': text => text.includes('create | 200 | incomplete') && text.includes('Result: FAIL'),
  });
}
