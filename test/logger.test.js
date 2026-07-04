import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { activityLogger } from "../src/middlewares/activityLogger.middleware.js";
import { logger } from "../src/utils/logger.js";

test("logger exposes standard log levels", () => {
    assert.equal(typeof logger.debug, "function");
    assert.equal(typeof logger.info, "function");
    assert.equal(typeof logger.warn, "function");
    assert.equal(typeof logger.error, "function");
});

test("activityLogger assigns request id and response header", () => {
    const req = {
        headers: {
            "x-request-id": "request-123",
            "user-agent": "node-test",
        },
        method: "GET",
        originalUrl: "/health",
        ip: "127.0.0.1",
        socket: {},
    };

    const res = new EventEmitter();
    res.statusCode = 200;
    res.headers = {};
    res.setHeader = (name, value) => {
        res.headers[name] = value;
    };
    res.getHeader = (name) => res.headers[name.toLowerCase()];

    let nextCalled = false;
    activityLogger(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.id, "request-123");
    assert.equal(res.headers["X-Request-Id"], "request-123");

    res.emit("finish");
});
