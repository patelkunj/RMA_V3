import { Router } from "express";

const router = Router();

const openapi = {
    openapi: "3.1.0",
    info: { title: "RMA V3 API", version: "1.1.0", description: "Production RMA, repair workflow, logistics, inventory, billing, and integration API." },
    servers: [{ url: "/api/v1" }],
    components: {
        securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
            apiKey: { type: "apiKey", in: "header", name: "X-API-Key" },
        },
        schemas: {
            ApiResponse: { type: "object", required: ["statusCode", "success", "message"], properties: { statusCode: { type: "integer" }, success: { type: "boolean" }, message: { type: "string" }, data: {} } },
            Error: { type: "object", required: ["statusCode", "success", "message"], properties: { statusCode: { type: "integer" }, success: { const: false }, message: { type: "string" }, errors: { type: "array", items: {} } } },
        },
    },
    security: [{ bearerAuth: [] }],
    paths: {
        "/customers/login": { post: { summary: "Authenticate a customer within an explicit organization tenant", responses: { 200: { description: "Authenticated" }, 202: { description: "MFA code required" }, 401: { description: "Invalid organization, email, or password" } } } },
        "/customers/password-reset/request": { post: { summary: "Request a customer password reset within an explicit organization tenant", responses: { 200: { description: "Request accepted" } } } },
        "/repairjobs": { get: { summary: "List tenant-visible repair jobs", responses: { 200: { description: "Repair jobs" } } }, post: { summary: "Create an internal job or customer RMA request", parameters: [{ in: "header", name: "Idempotency-Key", required: true, schema: { type: "string" } }], responses: { 201: { description: "Created" } } } },
        "/repairjobs/{id}/status": { patch: { summary: "Transition a repair job through the enforced state machine", parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Updated" }, 409: { description: "Invalid transition" } } } },
        "/repairjobs/{id}/assignment": { patch: { summary: "Assign a technician and priority", responses: { 200: { description: "Assigned" } } } },
        "/repairjobs/{id}/work-logs": { post: { summary: "Record inspection, diagnosis, repair, test, or QA work", responses: { 201: { description: "Created" } } } },
        "/repairjobs/{id}/estimates": { post: { summary: "Create a versioned repair estimate", responses: { 201: { description: "Created" } } } },
        "/organizations/{id}/logo": {
            get: { summary: "Download the tenant organization logo", responses: { 200: { description: "PNG or JPEG logo" }, 404: { description: "Logo not configured" } } },
            put: { summary: "Upload or replace an organization logo", responses: { 200: { description: "Logo updated" }, 413: { description: "Logo exceeds 2 MB" }, 415: { description: "Unsupported or invalid image" } } },
            delete: { summary: "Remove an organization logo", responses: { 200: { description: "Logo removed" } } },
        },
        "/inventory": { get: { summary: "List inventory", responses: { 200: { description: "Inventory" } } }, post: { summary: "Create inventory item", responses: { 201: { description: "Created" } } } },
        "/billing/repair-jobs/{repairJobId}/invoices": { post: { summary: "Create and optionally issue a persistent invoice", responses: { 201: { description: "Created" } } } },
        "/integrations/ping": { get: { summary: "Validate an API key", security: [{ apiKey: [] }], responses: { 200: { description: "Valid" } } } },
    },
};

router.get("/openapi.json", (req, res) => res.status(200).json(openapi));
router.get("/", (req, res) => res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><title>RMA V3 API</title></head><body><main><h1>RMA V3 API</h1><p>The OpenAPI 3.1 contract is available at <a href="/api-docs/openapi.json">/api-docs/openapi.json</a>.</p></main></body></html>`));

export default router;
