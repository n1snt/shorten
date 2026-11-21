# k6 realistic average-load test

100M DAU × 5 requests/day = 500M/day = **5,787 RPS** on average, rounded to **6,000**.
Assumed mix: **90% redirects, 10% writes**, split equally across create/update/delete.

With k6 installed and the app/database running, run from the repo root:

```sh
k6 run --quiet load_test/load.js
```

- Runs for 60 seconds: 5,400 redirects/sec and 200 create→update→delete cycles/sec.
- Uniform reads across 1,000 seeded URLs; redirects are never followed.
- Reports target/achieved RPS, p95, max latency (informational only), and HTTP error percentage per API.
- Pass requires **p95 <100 ms for each API**, correct responses, full request counts,
  and zero HTTP errors/dropped iterations. Timings include connection setup/client waiting.
- Stops early on correctness failures. Other threshold failures produce a nonzero exit code.
- Dropped iterations mean the requested schedule was missed; inspect both server
  latency and load-generator VU/CPU limits before interpreting capacity.
- Setup, a brief read warm-up, and seed cleanup are excluded from measured API timings.
  Writes delete their own records in `finally`; seed URLs are deleted afterward.
  Forced termination, setup timeout, or failed deletion can leave test rows behind.

Optional settings (only target systems you have permission to test):

```sh
k6 run --quiet -e BASE_URL=http://localhost:8080 -e RATE=6000 -e DURATION_SECONDS=120 -e SEED_URLS=1000 load_test/load.js
```

`RATE` is total API RPS and must be a multiple of 30 to preserve the mix.
Quick smoke test: `k6 run --quiet -e RATE=60 -e DURATION_SECONDS=5 -e SEED_URLS=20 load_test/load.js`.
Script self-check (no app needed): `k6 run --quiet load_test/load.test.js`.

This is **average traffic**, not a peak-load or 1B-row capacity test. A small uniform
dataset misses storage/cache pressure and real-world popularity skew. Running the
app, database, and generator on one machine also limits the result. DAU alone does
not determine peak RPS, URL creation rate, retention, or read/write ratio.

Code-space note: 8 hex characters give 4.29B possible codes, not collision-free
capacity for 1B URLs. The current deterministic hash retry repeats the same code;
this test does not change the generator or prove uniqueness at that scale.
