import test from "node:test";
import assert from "node:assert/strict";

process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "test-access-secret";
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "test-refresh-secret";

test("Express app imports successfully", async () => {
    const { app } = await import("../src/app.js");

    assert.equal(typeof app.use, "function");
});
