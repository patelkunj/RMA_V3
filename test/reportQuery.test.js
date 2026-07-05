import test from "node:test";
import assert from "node:assert/strict";
import {
    buildRepairJobReportWhere,
    parseJobStatus,
    parsePagination,
    parseReportDateRange,
} from "../src/utils/reportQuery.js";

test("parseReportDateRange accepts bounded explicit ranges", () => {
    const range = parseReportDateRange({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
    });

    assert.equal(range.startDate.getFullYear(), 2026);
    assert.equal(range.startDate.getMonth(), 0);
    assert.equal(range.startDate.getDate(), 1);
    assert.equal(range.endDate.getDate(), 31);
});

test("parseReportDateRange rejects reversed and oversized ranges", () => {
    assert.throws(() => parseReportDateRange({
        startDate: "2026-02-01",
        endDate: "2026-01-01",
    }), /startDate/);

    assert.throws(() => parseReportDateRange({
        startDate: "2025-01-01",
        endDate: "2026-12-31",
    }), /cannot exceed/);
});

test("parsePagination clamps limits and normalizes page numbers", () => {
    assert.deepEqual(parsePagination({ page: "-1", limit: "999" }), {
        page: 1,
        limit: 100,
        skip: 0,
    });
});

test("parseJobStatus normalizes valid statuses and rejects unknown values", () => {
    assert.equal(parseJobStatus("waiting_parts"), "WAITING_PARTS");
    assert.throws(() => parseJobStatus("dispatch"), /Invalid repair job status/);
});

test("buildRepairJobReportWhere combines access and report filters with AND", () => {
    const where = buildRepairJobReportWhere(
        { organizationId: { in: [1, 2] } },
        { organizationId: 1, customerId: 10, status: "CREATED" }
    );

    assert.deepEqual(where, {
        AND: [
            { organizationId: { in: [1, 2] } },
            {
                organizationId: 1,
                customerId: 10,
                jobStatus: "CREATED",
            },
        ],
    });
});
