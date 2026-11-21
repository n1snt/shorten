# Local load-test baseline

| Concurrent clients | Requests/sec (approx.) | p95 latency |
| --- | ---: | ---: |
| 10 | 7,059 | 2.54 ms |
| 50 | 8,136 | 12.85 ms |
| 100 | 8,565 | 22.30 ms |

**Highest observed throughput: ~8,565 redirect requests/sec**, with zero errors across 712,785 requests. Every response returned HTTP 302 with the expected destination.
