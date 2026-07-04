import test from "node:test";
import assert from "node:assert/strict";

process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "test-access-secret";
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "test-refresh-secret";
process.env.ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "15m";
process.env.REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";

const {
    generateAccessToken,
    generateRefreshToken,
    isJwtExpired,
} = await import("../src/utils/tokenHandler.js");

test("generateAccessToken creates a non-expired JWT", () => {
    const token = generateAccessToken({
        id: 1,
        email: "user@example.com",
        firstName: "Test",
    });

    assert.equal(typeof token, "string");
    assert.equal(isJwtExpired(token), false);
});

test("generateRefreshToken creates a non-expired JWT", () => {
    const token = generateRefreshToken({ id: 1 });

    assert.equal(typeof token, "string");
    assert.equal(isJwtExpired(token), false);
});

test("isJwtExpired treats malformed tokens as expired", () => {
    assert.equal(isJwtExpired("not-a-token"), true);
});
