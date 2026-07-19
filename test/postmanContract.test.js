import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const collection = JSON.parse(fs.readFileSync("postman/RMA_V3_API.postman_collection.json", "utf8"));
const LEGACY_FOLDER = "Legacy Compatibility (Deprecated)";
const LEGACY_URL = /\/api\/v1\/(?:repairjobs|serialnumbers|repairjobcost|proudcts|repairjob-timeline)(?:[/?]|$)|\/(?:list_user|getUserDetail|forgetPassword|change_password|activeuser|activecustomer|list_repairjob|add_repairjob|add_multipal_repairjob|serial_number_lookup|updateTrackingNumber|updateSKU|updateSerialNumber|updateStatus|updateDispatchId|receivejob)(?:[/?]|$)/;

const requests = [];
const walk = (items, folders = []) => {
    for (const item of items || []) {
        const nextFolders = item.item ? [...folders, item.name] : folders;
        if (item.request) requests.push({ item, folders });
        walk(item.item, nextFolders);
    }
};
walk(collection.item);

test("Postman primary requests use canonical route names", () => {
    const violations = requests
        .filter(({ folders }) => !folders.includes(LEGACY_FOLDER))
        .filter(({ item }) => LEGACY_URL.test(typeof item.request.url === "string" ? item.request.url : item.request.url?.raw || ""))
        .map(({ item }) => item.name);

    assert.deepEqual(violations, []);
});

test("Postman raw JSON bodies remain parseable after variable substitution", () => {
    const invalid = [];
    for (const { item } of requests) {
        if (item.request.body?.mode !== "raw" || !item.request.body.raw?.trim()) continue;
        const substituted = item.request.body.raw
            .replace(/\{\{\$[^}]+\}\}/g, "1")
            .replace(/\{\{[^}]+\}\}/g, "1");
        try {
            JSON.parse(substituted);
        } catch {
            invalid.push(item.name);
        }
    }
    assert.deepEqual(invalid, []);
});

test("Postman runs the shared JSON response-envelope assertion", () => {
    const testScript = collection.event
        ?.find((event) => event.listen === "test")
        ?.script?.exec?.join("\n") || "";
    assert.match(testScript, /standard API envelope/);
    assert.match(testScript, /responseBody\.statusCode/);
    assert.match(testScript, /responseBody\.errors/);
});
