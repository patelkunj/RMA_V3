import { Router } from "express";

const router = Router();

const openapi = {
    openapi: "3.1.0",
    info: { title: "RMA V3 API", version: "1.2.0", description: "Production RMA, repair workflow, logistics, inventory, billing, and integration API. Canonical routes use lowercase kebab-case resource names." },
    servers: [{ url: "/api/v1" }],
    components: {
        securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
            apiKey: { type: "apiKey", in: "header", name: "X-API-Key" },
        },
        schemas: {
            ApiResponse: { type: "object", required: ["statusCode", "success", "message", "data"], properties: { statusCode: { type: "integer" }, success: { const: true }, message: { type: "string" }, data: {} } },
            Error: { type: "object", required: ["statusCode", "success", "message", "data", "errors"], properties: { statusCode: { type: "integer" }, success: { const: false }, message: { type: "string" }, data: { type: "null" }, errors: { type: "array", items: {} } } },
        },
    },
    security: [{ bearerAuth: [] }],
    paths: {
        "/users/login": { post: { security: [], summary: "Authenticate an internal user", responses: { 200: { description: "Authenticated" }, 202: { description: "MFA code required" }, 401: { description: "Invalid credentials" } } } },
        "/users/activate/{token}": { get: { security: [], summary: "Activate an internal-user account", parameters: [{ in: "path", name: "token", required: true, schema: { type: "string" } }], responses: { 200: { description: "Activated" }, 400: { description: "Invalid or expired token" } } } },
        "/users/password-reset/request": { post: { security: [], summary: "Request an internal-user password reset", responses: { 200: { description: "Request accepted" } } } },
        "/users/password-reset/{token}": { post: { security: [], summary: "Complete an internal-user password reset", parameters: [{ in: "path", name: "token", required: true, schema: { type: "string" } }], responses: { 200: { description: "Password changed" }, 400: { description: "Invalid or expired token" } } } },
        "/users": { get: { summary: "List managed users", responses: { 200: { description: "Users" } } }, post: { summary: "Create a user", responses: { 201: { description: "Created" }, 409: { description: "Email already exists" } } } },
        "/users/{id}": { parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], get: { summary: "Get a managed user", responses: { 200: { description: "User" }, 404: { description: "Not found" } } }, put: { summary: "Replace managed user details", responses: { 200: { description: "Updated" } } } },
        "/users/{id}/status": { patch: { summary: "Set a managed user's active status", parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Updated" }, 409: { description: "Self-deactivation is not allowed" } } } },
        "/customers/login": { post: { security: [], summary: "Authenticate a customer within an explicit organization tenant", responses: { 200: { description: "Authenticated" }, 202: { description: "MFA code required" }, 401: { description: "Invalid organization, email, or password" } } } },
        "/customers/activate/{token}": { get: { security: [], summary: "Activate a customer account", parameters: [{ in: "path", name: "token", required: true, schema: { type: "string" } }], responses: { 200: { description: "Activated" }, 400: { description: "Invalid or expired token" } } } },
        "/customers/password-reset/request": { post: { security: [], summary: "Request a customer password reset within an explicit organization tenant", responses: { 200: { description: "Request accepted" } } } },
        "/customers/password-reset/{token}": { post: { security: [], summary: "Complete a customer password reset", parameters: [{ in: "path", name: "token", required: true, schema: { type: "string" } }], responses: { 200: { description: "Password changed" }, 400: { description: "Invalid or expired token" } } } },
        "/customers": { get: { summary: "List tenant-visible customers", responses: { 200: { description: "Customers" } } }, post: { summary: "Create a customer", responses: { 201: { description: "Created" }, 409: { description: "Customer already exists" } } } },
        "/customers/{id}": { parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], get: { summary: "Get a customer", responses: { 200: { description: "Customer" }, 404: { description: "Not found" } } }, put: { summary: "Replace customer details", responses: { 200: { description: "Updated" } } } },
        "/customers/{id}/status": { patch: { summary: "Set a customer's active status", parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Updated" } } } },
        "/products": { get: { summary: "List tenant-visible products", responses: { 200: { description: "Products" } } }, post: { summary: "Create a product", responses: { 201: { description: "Created" }, 409: { description: "SKU already exists" } } } },
        "/products/{id}": { put: { summary: "Update a product", parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Updated" }, 404: { description: "Not found" } } } },
        "/serial-numbers": { get: { summary: "List tenant-visible serial numbers", responses: { 200: { description: "Serial numbers" } } }, post: { summary: "Create a serial number", responses: { 201: { description: "Created" }, 409: { description: "Serial number already exists" } } } },
        "/serial-numbers/{id}": { put: { summary: "Update a serial number", parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Updated" }, 404: { description: "Not found" } } } },
        "/repair-jobs": { get: { summary: "List tenant-visible repair jobs", responses: { 200: { description: "Repair jobs" } } }, post: { summary: "Create an internal job or customer RMA request", parameters: [{ in: "header", name: "Idempotency-Key", required: true, schema: { type: "string" } }], responses: { 201: { description: "Created" } } } },
        "/repair-jobs/{id}": { get: { summary: "Get a tenant-visible repair job", parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Repair job" }, 404: { description: "Not found" } } } },
        "/repair-jobs/{id}/status": { patch: { summary: "Transition a repair job through the enforced state machine", parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Updated" }, 409: { description: "Invalid transition" } } } },
        "/repair-jobs/{id}/assignment": { patch: { summary: "Assign a technician and priority", parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Assigned" } } } },
        "/repair-jobs/{id}/work-logs": { post: { summary: "Record inspection, diagnosis, repair, test, or QA work", parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { 201: { description: "Created" } } } },
        "/repair-jobs/{id}/estimates": { post: { summary: "Create a versioned repair estimate", parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { 201: { description: "Created" } } } },
        "/chats/repair-jobs/{repairJobId}": { parameters: [{ in: "path", name: "repairJobId", required: true, schema: { type: "integer" } }], get: { summary: "List repair-job chat messages", responses: { 200: { description: "Messages" } } }, post: { summary: "Create a repair-job chat message", responses: { 201: { description: "Created" } } } },
        "/chats/repair-jobs/{repairJobId}/read": { patch: { summary: "Mark repair-job chat messages as read", parameters: [{ in: "path", name: "repairJobId", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Updated" } } } },
        "/comments/repair-jobs/{repairJobId}": { parameters: [{ in: "path", name: "repairJobId", required: true, schema: { type: "integer" } }], get: { summary: "List repair-job comments", responses: { 200: { description: "Comments" } } }, post: { summary: "Create a repair-job comment", responses: { 201: { description: "Created" } } } },
        "/comments/{id}": { patch: { summary: "Update a repair-job comment", parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Updated" }, 404: { description: "Not found" } } } },
        "/repair-job-costs": { get: { summary: "List costs for a repair job", parameters: [{ in: "query", name: "repairJobId", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Costs" } } }, post: { summary: "Create a repair-job cost", responses: { 201: { description: "Created" } } } },
        "/repair-job-costs/{id}": { put: { summary: "Update a repair-job cost", parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Updated" }, 404: { description: "Not found" } } } },
        "/repair-job-timeline/{repairJobId}/audit-logs": { get: { summary: "List repair-job audit logs", parameters: [{ in: "path", name: "repairJobId", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Audit logs" } } } },
        "/repair-job-timeline/{repairJobId}/tracking": { get: { summary: "List repair-job tracking history", parameters: [{ in: "path", name: "repairJobId", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Tracking history" } } } },
        "/notifications": { get: { summary: "List notifications for the signed-in actor", responses: { 200: { description: "Notifications" } } } },
        "/notifications/{id}/read": { patch: { summary: "Mark a notification as read", parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Updated" }, 404: { description: "Not found" } } } },
        "/documents": { get: { summary: "List repair-job documents", parameters: [{ in: "query", name: "repairJobId", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Documents" } } } },
        "/documents/{id}": { get: { summary: "Get document metadata", parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Document" }, 404: { description: "Not found" } } } },
        "/sessions": { get: { summary: "List active sessions", responses: { 200: { description: "Sessions" } } } },
        "/sessions/{id}": { delete: { summary: "Revoke a session", parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Revoked" }, 404: { description: "Not found" } } } },
        "/integrations/organizations/{organizationId}": { get: { summary: "List integrations for an organization", parameters: [{ in: "path", name: "organizationId", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Integrations" } } } },
        "/organizations": { get: { summary: "List tenant-visible organizations", responses: { 200: { description: "Organizations" } } }, post: { summary: "Create an organization", responses: { 201: { description: "Created" } } } },
        "/organizations/{id}": { parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], get: { summary: "Get an organization", responses: { 200: { description: "Organization" }, 404: { description: "Not found" } } }, put: { summary: "Update an organization", responses: { 200: { description: "Updated" } } } },
        "/organizations/{id}/status": { patch: { summary: "Set an organization's active status", parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Updated" } } } },
        "/organizations/{id}/logo": {
            parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }],
            get: { summary: "Download the tenant organization logo", responses: { 200: { description: "PNG or JPEG logo" }, 404: { description: "Logo not configured" } } },
            put: { summary: "Upload or replace an organization logo", responses: { 200: { description: "Logo updated" }, 413: { description: "Logo exceeds 2 MB" }, 415: { description: "Unsupported or invalid image" } } },
            delete: { summary: "Remove an organization logo", responses: { 200: { description: "Logo removed" } } },
        },
        "/inventory": { get: { summary: "List inventory", responses: { 200: { description: "Inventory" } } }, post: { summary: "Create inventory item", responses: { 201: { description: "Created" } } } },
        "/billing/repair-jobs/{repairJobId}/invoices": { post: { summary: "Create and optionally issue a persistent invoice", parameters: [{ in: "path", name: "repairJobId", required: true, schema: { type: "integer" } }], responses: { 201: { description: "Created" } } } },
        "/integrations/ping": { get: { summary: "Validate an API key", security: [{ apiKey: [] }], responses: { 200: { description: "Valid" } } } },
    },
};

router.get("/openapi.json", (req, res) => res.status(200).json(openapi));
router.get("/", (req, res) => res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><title>RMA V3 API</title></head><body><main><h1>RMA V3 API</h1><p>The OpenAPI 3.1 contract is available at <a href="/api-docs/openapi.json">/api-docs/openapi.json</a>.</p></main></body></html>`));

export { openapi };
export default router;
