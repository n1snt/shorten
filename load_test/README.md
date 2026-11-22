# k6 realistic average-load test

100M DAU × 5 requests/day = 500M/day = **5,787 RPS** on average, rounded to **6,000**.
Assumed mix: **90% redirects, 10% writes**, split equally across create/update/delete.

With k6 installed and the app/database running, run from the repo root:

```sh
k6 run --quiet load_test/load.js
```

- Ramps from ~10% to target over 30 seconds, then measures 60 seconds at target:
  5,400 redirects/sec and 200 create→update→delete cycles/sec. Each scenario keeps the same VU pool throughout.
- Uniform reads across 1,000 seeded URLs; redirects are never followed.
- Reports target/achieved RPS, p95, max latency (informational only), and exact HTTP error count/percentage per API.
- Pass requires **p95 <100 ms for each API**, correct responses, full measured request counts,
  and zero measured HTTP errors/missed iteration starts. Timings include connection setup/client waiting.
- Correctness failures do not abort measurement; any failed threshold produces a nonzero exit code at the end.
- Warm-up errors, checks, and estimated missed starts are reported separately and do not fail steady state.
  k6's executor drops have no per-VU phase tag, so steady misses are calculated from target minus actual
  started iterations; total k6 drops (including warm-up) are also shown. Inspect server latency and
  generator VU/CPU limits when measured starts are missed.
- Setup only creates URL records; it does not preload the cache or flush existing Redis data.
  The cache fills naturally through requests during the ramp and measured traffic.
  Setup, ramp, and seed cleanup are excluded from measured API timings.
  An entire CRUD cycle is assigned to the phase in which its iteration started; cleanup must still pass.
  Writes delete their own records in `finally`; seed URLs are deleted afterward.
  Forced termination, setup timeout, or failed deletion can leave test rows behind.

Optional settings (only target systems you have permission to test):

```sh
k6 run --quiet -e BASE_URL=http://localhost:8080 -e RATE=6000 -e WARMUP_SECONDS=30 -e DURATION_SECONDS=120 -e SEED_URLS=1000 load_test/load.js
```

`RATE` is total API RPS and must be a multiple of 30 to preserve the mix.
`WARMUP_SECONDS` (default 30) and `DURATION_SECONDS` (default 60) are positive integer seconds.
`REDIRECT_VUS` and `WRITE_VUS` override the preallocated concurrency budgets (positive integers).
At 6,000 RPS the defaults are 1,090 read VUs and 130 write VUs, with no dynamic allocation.
These provide headroom, not a guarantee: tune against observed iteration times and generator CPU/memory.
For example: `k6 run --quiet -e REDIRECT_VUS=1500 -e WRITE_VUS=200 load_test/load.js`.

Quick smoke test: `k6 run --quiet -e RATE=60 -e WARMUP_SECONDS=2 -e DURATION_SECONDS=5 -e SEED_URLS=20 load_test/load.js`.
Script self-check (no app needed): `k6 run --quiet load_test/load.test.js`.
Cache correctness smoke test (app required): `k6 run --quiet load_test/cache.test.js`.
It warms a URL, expires it through PATCH (expects 404), extends it (expects 302), then deletes
the cached URL (expects 404). It cleans up its own record and does not change the load-test mix.
It does not test a cached URL naturally reaching its expiry time or waiting out Redis's TTL.

This is **average traffic**, not a peak-load or 1B-row capacity test. A small uniform
dataset misses storage/cache pressure and real-world popularity skew. Running the
app, database, and generator on one machine also limits the result. DAU alone does
not determine peak RPS, URL creation rate, retention, or read/write ratio.
This measures steady-state traffic after a gradual ramp, not a sudden cold-cache burst.

Code-space note: 8 hex characters give 4.29B possible codes, not collision-free
capacity for 1B URLs. The current deterministic hash retry repeats the same code;
this test does not change the generator or prove uniqueness at that scale.
