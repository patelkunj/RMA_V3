import test from "node:test";
import assert from "node:assert/strict";
import {
    assertStrongPassword,
    assertValidEmail,
    normalizeEmail,
    parsePositiveInt,
} from "../src/utils/validation.js";

test("normalizeEmail trims and lowercases email addresses", () => {
    assert.equal(normalizeEmail("  USER@Example.COM "), "user@example.com");
});

test("assertValidEmail accepts valid email addresses", () => {
    assert.doesNotThrow(() => assertValidEmail("user@example.com"));
});

test("assertValidEmail rejects invalid email addresses", () => {
    assert.throws(() => assertValidEmail("not-an-email"), /valid email/);
});

test("assertStrongPassword requires length and mixed character classes", () => {
    assert.doesNotThrow(() => assertStrongPassword("StrongPass123"));
    assert.throws(() => assertStrongPassword("short1A"), /at least 10/);
    assert.throws(() => assertStrongPassword("lowercaseonly1"), /uppercase/);
});

test("parsePositiveInt returns positive integers only", () => {
    assert.equal(parsePositiveInt("42", "id"), 42);
    assert.throws(() => parsePositiveInt("0", "id"), /positive integer/);
    assert.throws(() => parsePositiveInt("1.5", "id"), /positive integer/);
});
