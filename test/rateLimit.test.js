import test from "node:test";
import assert from "node:assert/strict";
import { rateLimit } from "../src/middlewares/rateLimit.middleware.js";

const createResponse = () => {
    const response = {
        statusCode: null,
        body: null,
        headers: {},
        setHeader(name, value) {
            this.headers[name] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };

    return response;
};

test("rateLimit allows requests up to the configured max", () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 2, keyPrefix: "test-allow" });
    const req = { ip: "127.0.0.10", headers: {}, socket: {} };
    let nextCalls = 0;

    limiter(req, createResponse(), () => { nextCalls += 1; });
    limiter(req, createResponse(), () => { nextCalls += 1; });

    assert.equal(nextCalls, 2);
});

test("rateLimit rejects requests over the configured max", () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1, keyPrefix: "test-reject" });
    const req = { ip: "127.0.0.11", headers: {}, socket: {} };
    const first = createResponse();
    const second = createResponse();

    limiter(req, first, () => {});
    limiter(req, second, () => {});

    assert.equal(second.statusCode, 429);
    assert.equal(second.body.statusCode, 429);
});
