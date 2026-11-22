# Local load-test baseline — v2

30-second gradual traffic ramp, then 60 seconds at target load. Reads used 1,000 seeded URLs; the cache filled naturally through traffic, with no explicit preloading or Redis flush. Redirects were not followed.

| API | Requests/sec (approx.) | p95 latency |
| --- | ---: | ---: |
| Redirect | 5,400 | 4 ms |
| Create | 200 | 6 ms |
| Update | 200 | 5 ms |
| Delete | 200 | 4 ms |

**Sustained target: ~6,000 API requests/sec**, with zero HTTP errors, dropped iterations, or missed starts across 360,003 measured requests. All APIs passed **p95 <100 ms**.

This tests 90% redirects and 10% CRUD writes, not maximum throughput. It is not directly comparable to v1's redirect-only benchmark.

## This was on dev build
