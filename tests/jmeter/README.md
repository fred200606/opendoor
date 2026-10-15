# JMeter load test (SIA doc 7.3, Appendix D)

`opendoor-matching.jmx`: candidates search in "Matches my needs" mode
(`GET /api/job-postings?match=1&page=1…10`) and open one posting from that page
(`GET /api/job-postings/{id}`), through the API Gateway with their own token. Assertions: status
200, `meta.match_mode == true`, `meta.per_page == 12`, at most 3,000 ms. Targets: **P95 < 1,500 ms
and error rate < 1 % at 50 users**.

## 1. Test data and tokens

```bash
cd services/core-api
php artisan load-test:data --tokens=../../tests/jmeter/tokens.csv
```

Creates 500 open postings from 10 verified "Load Test Company" employers and 50 candidates with
accommodation needs (all `loadtest-…@opendoor.test`), and writes one API token per candidate to
`tests/jmeter/tokens.csv` (git-ignored, one token per line). Same data on every run, new tokens each
time. Remove it all afterwards:

```bash
php artisan load-test:data --remove --tokens=../../tests/jmeter/tokens.csv
```

In production the command asks for confirmation (`--force` skips it). Without `--tokens` the file
goes to `storage/app/private/load-test-tokens.csv` in the Core service – copy it from there to
`tests/jmeter/tokens.csv` on the machine that runs JMeter.

## 2. Gateway rate limit

The gateway allows `RATE_LIMIT_PER_MIN` requests per client IP (120 in production). JMeter runs from
one machine and sends 10–40 requests per second, so most requests would get 429 and the run would
measure the limiter. Raise the limit **for the test only** (e.g. `RATE_LIMIT_PER_MIN=100000`) and set it
back afterwards.

## 3. Run (CLI mode)

JMeter 5.6.3 needs Java 8+ (Windows: `C:\tools\apache-jmeter\bin\jmeter.bat`). Run from this folder;
create `report/` first (JMeter needs the parent folder of `-o`).

| Run | Command |
|---|---|
| Load – 50 users, 60 s ramp-up, 10 loops (1,000 requests) | `jmeter -n -t opendoor-matching.jmx -Jhost=<gateway host> -l results-load.jtl -e -o report/load` |
| Stress – 100 users, 5 loops | `jmeter -n -t opendoor-matching.jmx -Jhost=<gateway host> -Jthreads=100 -Jloops=5 -l results-stress-100.jtl -e -o report/stress-100` |
| Stress – 200 users, 5 loops | `jmeter -n -t opendoor-matching.jmx -Jhost=<gateway host> -Jthreads=200 -Jloops=5 -l results-stress-200.jtl -e -o report/stress-200` |

Defaults: `-Jprotocol=https`, no port, `-Jrampup=60`, `-Jtokens=tokens.csv`. Against the local stack
add `-Jprotocol=http -Jhost=localhost -Jport=8080`. A run's `-o` folder must not exist yet.

`report/<run>/index.html` is the HTML dashboard: its Statistics table is the Aggregate Report
(average, median, P95, throughput, error %), and Charts → Over Time → Response Times Over Time is the
chart for the SIA doc. `report/` and `results*.jtl` are git-ignored.

## Local dry run (2026-10-11)

Against the local stack (`php artisan serve` on Windows answers one request at a time), load profile:
1,000 requests, all HTTP 200, average 1,651 ms, P95 2,714 ms, 10.5 requests/s, 1.8 % over the 3 s
duration assertion. This only shows that the plan works; the reported numbers come from the
deployed stack.

## Production runs (2026-10-16, Railway Free Trial, Singapore)

Run from a laptop in the Philippines against `gateway-production-4e58.up.railway.app`, with the
load-test data created and removed over `railway ssh` and the gateway limit raised only for the
test window. Every request returned 200 and passed all assertions (0 % errors in every run).

| Run | Users active at once | Requests | Median | P95 | Throughput |
|---|---|---|---|---|---|
| Load – 50 users, 60 s ramp-up, 10 loops (as above) | ≤ 3 | 1,000 | 98 ms | 204 ms | 16.4/s |
| Stress – 100 users, 60 s ramp-up, 5 loops | ≤ 4 | 1,000 | 98 ms | 222 ms | 16.6/s |
| Stress – 200 users, 60 s ramp-up, 5 loops | ≤ 8 | 2,000 | 98 ms | 220 ms | 33.1/s |
| Burst – 50 users, **5 s ramp-up**, 10 loops | 50 | 1,000 | 500 ms | 748 ms | 72.4/s |
| Burst – 100 users, 5 s ramp-up, 5 loops | 100 | 1,000 | 909 ms | 1,333 ms | 77.5/s |
| Burst – 200 users, 5 s ramp-up, 5 loops | 200 | 2,000 | 2,010 ms | 2,838 ms | 81.3/s |

With a 60 s ramp-up each user finishes its loops before most others start (`allThreads` column of
the `.jtl`), so those runs never had more than 8 users at the same time. The burst runs add
`-Jrampup=5` so all users overlap, e.g.
`jmeter -n -t opendoor-matching.jmx -Jhost=<gateway host> -Jthreads=200 -Jloops=5 -Jrampup=5 -l results-prod-burst-200.jtl -e -o report/prod-burst-200`.
Throughput levels off at about 80 requests/s (one Core instance on the trial's shared vCPU), so
response times grow with concurrency; the target (P95 < 1,500 ms, errors < 1 % at 50 users) is met
in both profiles, and still at 100 concurrent users.
