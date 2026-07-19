import assert from "node:assert/strict";
import test from "node:test";
import { paginatedData } from "../src/utils/pagination.js";

test("paginatedData provides a canonical items/pagination shape and a legacy collection alias", () => {
    const items = [{ id: 1 }];
    assert.deepEqual(paginatedData(items, { total: 3, page: 2, limit: 2 }, "users"), {
        items,
        users: items,
        total: 3,
        page: 2,
        limit: 2,
        totalPages: 2,
        pagination: { total: 3, page: 2, limit: 2, totalPages: 2 },
    });
});
