# k6 redirect baseline

Requires [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/), the running
application, and PostgreSQL. Run from the project root:

```sh
k6 run load_test/load.js
```

Default: 10 redirects/second for 30 seconds against `http://localhost:8080`.
To change the target or load:

```sh
k6 run -e BASE_URL=http://localhost:8080 -e RATE=100 -e DURATION=2m load_test/load.js
```

The setup creates one URL and validates the create response. The measured workload
repeatedly reads that code, checking `302` and the exact `Location` header without
following redirects. Setup requests are excluded from the latency/error thresholds.

The run fails if redirect p95 is 100 ms or more, request errors reach 0.1%,
any correctness check fails, or iterations are dropped. There are 20 preallocated
virtual users; dropped iterations mean the requested rate was not sustained.
Check server and load-generator saturation before increasing `preAllocatedVUs`.

Use a disposable test database: each run leaves one row. Cleanup is intentionally
omitted because the application's DELETE currently does not execute its SQL.
This is a hot-link read baseline, not a write-throughput or large-dataset test.
