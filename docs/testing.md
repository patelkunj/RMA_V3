# Testing

## Verification suite

Run the deterministic validation and unit-test suite before committing changes:

```bash
npm run verify
```

Database integration tests use a disposable PostgreSQL database. Never point `TEST_DATABASE_URL` at a production or shared development database.
Test files run serially because the PostgreSQL suites intentionally exercise global outbox and worker claims; concurrency is created explicitly inside the relevant tests.

Run the built-in coverage gate separately when reviewing release readiness:

```bash
npm run test:coverage
```

The measured baseline when the gate was introduced was 38.18% for lines, 20.78% for functions, and 73.66% for branches. The enforced initial minimums are therefore 35% for lines, 20% for functions, and 25% for branches. They establish an honest ratchet without making the existing suite unusable. CI and release owners should raise these thresholds as coverage improves; do not lower them to accommodate new untested behavior.
The main CI workflow runs this gate after the database-backed verification suite.

## PostgreSQL, concurrency, and multi-instance tests

Apply migrations to an isolated database whose name contains `test` or `integration`, then run the complete suite with the explicit guards enabled:

```bash
RUN_DB_INTEGRATION_TESTS=true \
RUN_HTTP_INTEGRATION_TESTS=true \
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/rma_test \
npm test
```

These tests create uniquely named records and clean only their own data. They never truncate the database. Test files run serially, while each concurrency case creates its competing requests explicitly.

The database suites cover:

- two independent child-process API instances sharing PostgreSQL;
- global rate-limit buckets and actor-scoped idempotency across those instances;
- completed-response replay, conflicting idempotency-key reuse, and single stock mutation;
- competing outbox workers and exactly-once webhook claiming;
- refresh-token and MFA recovery-code single consumption;
- invoice creation, invoice numbering, payment references, payment-versus-void, and decimal balances;
- inventory row locking, estimate versions/decisions, RMA review, repair transitions, and SLA worker claims;
- tenant authentication, cross-tenant access denial, private upload round trips, and outbox retries.

`RUN_HTTP_INTEGRATION_TESTS=true` also enables temporary loopback tests for security headers, request IDs, authentication boundaries, malformed/oversized JSON, CORS, metrics authentication, canonical errors, multipart limits, MIME/signature validation, and malware-scanner failure cleanup. CI enables both guards after applying every migration.

## Opt-in load testing

The load runner is dependency-free and uses the Node.js 22 HTTP client. It is intentionally separate from `npm run verify` and does nothing unless `RUN_LOAD_TESTS=true` is set.

The runner provides two read-only profiles:

- `health` exercises `/health/live` and, at a lower weight, the PostgreSQL-backed `/health/ready` endpoint.
- `authenticated-read` logs in once or uses a supplied token, then exercises paginated repair-job, product, and notification reads. It never load-tests the login endpoint.

Every measured run reports scheduled, completed, successful, failed, dropped, and status-code counts; error categories; response bytes; achieved request rate; and p50, p95, p99, and maximum latency. The command exits unsuccessfully when any configured threshold fails.

### Safety controls

The default target is `http://127.0.0.1:3000`. Any non-loopback target must use HTTPS and requires both:

```text
LOAD_TEST_ALLOW_REMOTE=true
LOAD_TEST_CONFIRM_ORIGIN=https://exact-staging-origin.example.com
```

The confirmation must exactly match the target origin. Redirects are rejected. The runner also refuses to operate when its `NODE_ENV` is `production`; this is an additional guard and is not a substitute for checking the target carefully.

Normal runs are capped at 60 seconds, 20 concurrent requests, 50 requests per second, and 3,000 total scheduled requests, including warm-up traffic. Raising those limits requires `LOAD_TEST_ALLOW_HIGH_INTENSITY=true` and should only happen in an approved isolated performance environment. Absolute safety limits still apply.

Do not target production, use real customer credentials, or enable mutation scenarios. The included profiles only issue `GET` requests after their one-time setup.

### Local health test

Start the API against a disposable local database, then run:

```bash
NODE_ENV=test RUN_LOAD_TESTS=true npm run load:test
```

Defaults are a three-second warm-up followed by 15 seconds at 10 requests per second with four-request concurrency. The sanitized report is written to the operating system's temporary directory unless `LOAD_TEST_REPORT_PATH` is set.

### Authenticated read test

Use a dedicated test account. The runner accepts either `LOAD_TEST_ACCESS_TOKEN` or `LOAD_TEST_USER_EMAIL` and `LOAD_TEST_USER_PASSWORD`. MFA-enabled accounts also require `LOAD_TEST_MFA_CODE`. Secret values are never included in console summaries or JSON reports.

For the documented disposable seed database:

```bash
NODE_ENV=test \
RUN_LOAD_TESTS=true \
LOAD_TEST_PROFILE=authenticated-read \
LOAD_TEST_USER_EMAIL=seed.superadmin@example.test \
LOAD_TEST_USER_PASSWORD='Password123!' \
npm run load:test
```

Avoid placing reusable credentials directly in shell history. CI and staging runs should inject them through the environment's secret manager.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `RUN_LOAD_TESTS` | `false` | Required opt-in switch. |
| `LOAD_TEST_BASE_URL` | `http://127.0.0.1:3000` | Target origin only; paths, queries, fragments, and embedded credentials are rejected. |
| `LOAD_TEST_PROFILE` | `health` | `health` or `authenticated-read`. |
| `LOAD_TEST_DURATION_SECONDS` | `15` | Measured-phase duration. |
| `LOAD_TEST_WARMUP_SECONDS` | `3` | Unmeasured warm-up duration. |
| `LOAD_TEST_CONCURRENCY` | `4` | Maximum requests in flight. Excess fixed-rate arrivals are counted as dropped failures. |
| `LOAD_TEST_RPS` | `10` | Fixed request arrival rate. |
| `LOAD_TEST_TIMEOUT_MS` | `5000` | Per-request timeout, capped at 30 seconds. |
| `LOAD_TEST_MAX_ERROR_RATE` | `0.01` | Maximum total failed-request fraction. |
| `LOAD_TEST_MAX_5XX_RATE` | `0` | Maximum HTTP 5xx fraction. |
| `LOAD_TEST_MAX_429_RATE` | `0` | Maximum HTTP 429 fraction. |
| `LOAD_TEST_MAX_P95_MS` | `500` | Maximum p95 latency. |
| `LOAD_TEST_MAX_P99_MS` | `1000` | Maximum p99 latency. |
| `LOAD_TEST_MIN_RPS` | 80% of target | Minimum successful request rate. |
| `LOAD_TEST_REPORT_PATH` | OS temporary directory | Sanitized JSON report destination. |
| `LOAD_TEST_ACCESS_TOKEN` | unset | Dedicated bearer token for authenticated reads. |
| `LOAD_TEST_USER_EMAIL` | unset | Dedicated test-user email used for one setup login. |
| `LOAD_TEST_USER_PASSWORD` | unset | Dedicated test-user password used for one setup login. |
| `LOAD_TEST_MFA_CODE` | unset | Optional MFA code for the setup login. |
| `LOAD_TEST_ALLOW_REMOTE` | `false` | First remote-target approval. |
| `LOAD_TEST_CONFIRM_ORIGIN` | unset | Exact remote-origin confirmation. |
| `LOAD_TEST_ALLOW_HIGH_INTENSITY` | `false` | Separate approval for limits above the normal safety caps. |

The application-wide default rate limit is 300 requests per minute, and authentication has its own stricter limit. A load test that intentionally measures application throughput must raise those limits only on its isolated test server. Never weaken production rate limits for a benchmark.

## CI load test

The separate `Load Test` workflow runs manually and nightly. It creates an ephemeral PostgreSQL database, applies migrations, loads the idempotent test seed, disables background workers, and starts two independent API processes on loopback against the shared database. Both profiles run against both instances in parallel, and per-instance sanitized reports and server logs are retained as workflow artifacts.

The CI job uses higher rate-limit ceilings only inside its disposable environment. Its thresholds are intended as regression gates, not as proof of production capacity. Before a release, run an approved staging test with production-equivalent topology, logging, PostgreSQL sizing, object storage, and network controls.
