import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ApiError } from "../src/utils/ApiError.js";
import { ApiResponse } from "../src/utils/ApiResponse.js";

process.env.NODE_ENV = "test";
const { errorHandler } = await import("../src/app.js");

const expectedError = (statusCode, message, errors = []) => ({
    statusCode,
    data: null,
    message,
    success: false,
    errors,
});

test("ApiResponse serializes the canonical success envelope", () => {
    const body = JSON.parse(JSON.stringify(new ApiResponse(200, { id: 42 }, "Resource fetched.")));

    assert.deepEqual(body, {
        statusCode: 200,
        data: { id: 42 },
        message: "Resource fetched.",
        success: true,
    });
});

test("ApiError serializes its public message and validation details", () => {
    const errors = [{ field: "email", message: "Email is invalid." }];
    const body = JSON.parse(JSON.stringify(new ApiError(422, "Validation failed.", errors)));

    assert.deepEqual(body, expectedError(422, "Validation failed.", errors));
});

test("ApiError always exposes errors as an array", () => {
    const body = JSON.parse(JSON.stringify(new ApiError(400, "Invalid request.", "invalid details")));

    assert.deepEqual(body, expectedError(400, "Invalid request."));
});

test("ApiError normalizes invalid public status and message values", () => {
    const body = JSON.parse(JSON.stringify(new ApiError(200, { internal: "detail" })));

    assert.deepEqual(body, expectedError(500, "Something went wrong"));
});

test("global error responses use the same canonical error envelope", () => {
    const response = {
        headersSent: false,
        statusCode: null,
        body: null,
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };

    errorHandler(
        new ApiError(403, "CORS origin is not allowed"),
        { id: "response-contract", method: "GET", originalUrl: "/api/v1/response-contract" },
        response,
        () => assert.fail("next must not be called before headers are sent"),
    );

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.body, expectedError(403, "CORS origin is not allowed"));
});

test("global errors never expose non-ApiError exception messages", () => {
    const response = {
        headersSent: false,
        status(statusCode) { this.statusCode = statusCode; return this; },
        json(body) { this.body = body; return this; },
    };
    const parserError = new SyntaxError("Unexpected token containing request internals");
    parserError.status = 400;

    errorHandler(
        parserError,
        { id: "safe-error", method: "POST", originalUrl: "/api/v1/users" },
        response,
        () => assert.fail("next must not be called"),
    );

    assert.deepEqual(response.body, expectedError(400, "Invalid request."));
});

test("application code does not construct error responses with ApiResponse", () => {
    const files = [];
    const visit = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const target = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(target);
            else if (entry.name.endsWith(".js")) files.push(target);
        }
    };
    visit(path.resolve("src"));

    const violations = files.filter((file) => /new\s+ApiResponse\s*\(\s*[45]\d{2}\b/.test(fs.readFileSync(file, "utf8")));
    assert.deepEqual(violations, []);
});
