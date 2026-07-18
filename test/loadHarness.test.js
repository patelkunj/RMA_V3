import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../scripts/load-test.js", import.meta.url));
const childEnvironment = { ...process.env };
delete childEnvironment.NODE_TEST_CONTEXT;

const runHarness = (overrides = {}) => spawnSync(process.execPath, [script], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    timeout: 10_000,
    env: {
        ...childEnvironment,
        NODE_ENV: "test",
        RUN_LOAD_TESTS: "false",
        LOAD_TEST_USER_PASSWORD: "load-harness-secret-sentinel",
        ...overrides,
    },
});

const ensureChildProcessesAllowed = (t, result) => {
    if (result.error?.code === "EPERM") {
        t.skip("This sandbox does not permit child processes; CI executes these guard tests.");
        return false;
    }
    assert.ifError(result.error);
    return true;
};

test("load testing is inert unless explicitly enabled", (t) => {
    const result = runHarness();
    if (!ensureChildProcessesAllowed(t, result)) return;
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Load test skipped/);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /load-harness-secret-sentinel/);
});

test("load testing refuses production execution", (t) => {
    const result = runHarness({ RUN_LOAD_TESTS: "true", NODE_ENV: "production" });
    if (!ensureChildProcessesAllowed(t, result)) return;
    assert.equal(result.status, 1);
    assert.match(result.stderr, /disabled when NODE_ENV=production/);
    assert.doesNotMatch(result.stderr, /load-harness-secret-sentinel/);
});

test("remote targets require both approval and an exact HTTPS origin", (t) => {
    const denied = runHarness({
        RUN_LOAD_TESTS: "true",
        LOAD_TEST_BASE_URL: "https://staging.example.test",
    });
    if (!ensureChildProcessesAllowed(t, denied)) return;
    assert.equal(denied.status, 1);
    assert.match(denied.stderr, /LOAD_TEST_ALLOW_REMOTE=true/);

    const mismatched = runHarness({
        RUN_LOAD_TESTS: "true",
        LOAD_TEST_BASE_URL: "https://staging.example.test",
        LOAD_TEST_ALLOW_REMOTE: "true",
        LOAD_TEST_CONFIRM_ORIGIN: "https://different.example.test",
    });
    assert.equal(mismatched.status, 1);
    assert.match(mismatched.stderr, /must exactly match/);

    const insecure = runHarness({
        RUN_LOAD_TESTS: "true",
        LOAD_TEST_BASE_URL: "http://staging.example.test",
        LOAD_TEST_ALLOW_REMOTE: "true",
        LOAD_TEST_CONFIRM_ORIGIN: "http://staging.example.test",
    });
    assert.equal(insecure.status, 1);
    assert.match(insecure.stderr, /must use HTTPS/);
});

test("normal load runs enforce bounded intensity before sending requests", (t) => {
    const result = runHarness({
        RUN_LOAD_TESTS: "true",
        LOAD_TEST_DURATION_SECONDS: "61",
        LOAD_TEST_BASE_URL: "http://127.0.0.1:1",
    });
    if (!ensureChildProcessesAllowed(t, result)) return;
    assert.equal(result.status, 1);
    assert.match(result.stderr, /exceeds its safety limit of 60/);
    assert.doesNotMatch(result.stderr, /ECONNREFUSED/);
});

test("warm-up traffic counts toward the total request safety cap", (t) => {
    const result = runHarness({
        RUN_LOAD_TESTS: "true",
        LOAD_TEST_BASE_URL: "http://127.0.0.1:1",
        LOAD_TEST_DURATION_SECONDS: "60",
        LOAD_TEST_WARMUP_SECONDS: "15",
        LOAD_TEST_CONCURRENCY: "20",
        LOAD_TEST_RPS: "50",
    });
    if (!ensureChildProcessesAllowed(t, result)) return;
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Scheduled request count exceeds its safety limit/);
    assert.doesNotMatch(result.stderr, /ECONNREFUSED/);
});
