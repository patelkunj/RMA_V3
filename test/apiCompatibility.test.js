import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../src/app.js";
import { deprecateRoute } from "../src/middlewares/deprecation.middleware.js";
import { openapi } from "../src/routes/openapi.routes.js";

const layersForMount = (mountPath) => app._router.stack.filter((layer) =>
    layer.regexp?.test(mountPath) && !layer.regexp.test(`${mountPath}-different`),
);

const routerForMount = (mountPath) => layersForMount(mountPath).find((layer) => layer.name === "router")?.handle;

const hasRoute = (mountPath, method, routePath) => {
    const router = routerForMount(mountPath);
    return Boolean(router?.stack.some((layer) =>
        layer.route?.path === routePath && layer.route.methods?.[method.toLowerCase()],
    ));
};

const routeLayer = (mountPath, method, routePath) => routerForMount(mountPath)?.stack.find((layer) =>
    layer.route?.path === routePath && layer.route.methods?.[method.toLowerCase()],
);

test("canonical and compatibility resource prefixes are mounted", () => {
    const aliases = new Map([
        ["/api/v1/repairjobs", "/api/v1/repair-jobs"],
        ["/api/v1/proudcts", "/api/v1/products"],
        ["/api/v1/serialnumbers", "/api/v1/serial-numbers"],
        ["/api/v1/repairjobcost", "/api/v1/repair-job-costs"],
        ["/api/v1/repairjob-timeline", "/api/v1/repair-job-timeline"],
    ]);

    for (const [legacy, canonical] of aliases) {
        assert.ok(routerForMount(canonical), `${canonical} must be mounted`);
        assert.ok(routerForMount(legacy), `${legacy} must remain available during migration`);
        assert.ok(
            layersForMount(legacy).some((layer) => layer.name === "deprecatedRoute"),
            `${legacy} must include the deprecation compatibility middleware`,
        );
    }
});

test("canonical kebab-case and parameter-addressed routes are registered", () => {
    const routes = [
        ["/api/v1/users", "get", "/:id"],
        ["/api/v1/users", "put", "/:id"],
        ["/api/v1/customers", "patch", "/:id/status"],
        ["/api/v1/products", "put", "/:id"],
        ["/api/v1/serial-numbers", "put", "/:id"],
        ["/api/v1/repair-jobs", "get", "/:id"],
        ["/api/v1/repair-jobs", "patch", "/:id/tracking-number"],
        ["/api/v1/chats", "get", "/repair-jobs/:repairJobId"],
        ["/api/v1/chats", "patch", "/repair-jobs/:repairJobId/read"],
        ["/api/v1/comments", "post", "/repair-jobs/:repairJobId"],
        ["/api/v1/comments", "patch", "/:id"],
        ["/api/v1/repair-job-costs", "get", "/"],
        ["/api/v1/repair-job-costs", "put", "/:id"],
        ["/api/v1/notifications", "patch", "/:id/read"],
        ["/api/v1/integrations", "get", "/organizations/:organizationId"],
    ];

    for (const [mount, method, path] of routes) {
        assert.ok(hasRoute(mount, method, path), `${method.toUpperCase()} ${mount}${path} must exist`);
    }
});

test("deprecation middleware emits a standards-based migration hint", () => {
    const headers = new Map();
    const response = { setHeader(name, value) { headers.set(name.toLowerCase(), value); } };
    let continued = false;
    const request = {};

    deprecateRoute("/api/v1/repair-jobs")(request, response, () => { continued = true; });

    assert.equal(continued, true);
    assert.equal(request.isDeprecatedRoute, true);
    assert.match(headers.get("deprecation"), /^@\d+$/);
    assert.equal(headers.get("link"), "</api/v1/repair-jobs>; rel=\"successor-version\"");
    assert.match(headers.get("sunset"), /GMT$/);
    assert.match(headers.get("warning"), /^299 - /);
});

test("deprecation middleware rejects unsafe successor header values", () => {
    const headers = new Map();
    const response = { setHeader(name, value) { headers.set(name.toLowerCase(), value); } };

    deprecateRoute("/api/v1/repair-jobs\r\nX-Injected: yes")({}, response, () => {});

    assert.equal(headers.has("link"), false);
    assert.equal(headers.get("warning"), "299 - \"Deprecated API route\"");
});

test("deprecation middleware omits unresolved URI-template successors", () => {
    const headers = new Map();
    const response = {
        setHeader(name, value) { headers.set(name.toLowerCase(), value); },
        removeHeader(name) { headers.delete(name.toLowerCase()); },
    };

    deprecateRoute("/api/v1/repair-jobs/status")({}, response, () => {});
    deprecateRoute("/api/v1/users/{id}")({}, response, () => {});

    assert.equal(headers.has("link"), false);
    assert.equal(headers.get("warning"), "299 - \"Deprecated API route\"");
});

test("legacy action routes are explicitly marked as deprecated", () => {
    const legacyRoutes = [
        ["/api/v1/users", "post", "/list_user"],
        ["/api/v1/customers", "post", "/find"],
        ["/api/v1/repair-jobs", "post", "/list_repairjob"],
        ["/api/v1/chats", "post", "/list"],
        ["/api/v1/comments", "put", "/update"],
        ["/api/v1/repair-job-costs", "put", "/update"],
        ["/api/v1/notifications", "patch", "/read"],
        ["/api/v1/documents", "post", "/list"],
        ["/api/v1/sessions", "post", "/revoke"],
    ];

    for (const [mount, method, path] of legacyRoutes) {
        const layer = routeLayer(mount, method, path);
        assert.ok(layer, `${method.toUpperCase()} ${mount}${path} must remain registered`);
        assert.ok(
            layer.route.stack.some((handler) => handler.name === "deprecatedRoute"),
            `${method.toUpperCase()} ${mount}${path} must emit deprecation headers`,
        );
    }
});

test("static routes are not shadowed by earlier dynamic routes", () => {
    const conflicts = [];
    for (const mount of app._router.stack.filter((layer) => layer.name === "router")) {
        const stack = mount.handle.stack || [];
        for (let earlierIndex = 0; earlierIndex < stack.length; earlierIndex += 1) {
            const earlier = stack[earlierIndex];
            if (!earlier.route) continue;
            for (let laterIndex = earlierIndex + 1; laterIndex < stack.length; laterIndex += 1) {
                const later = stack[laterIndex];
                const laterPath = String(later.route?.path || "");
                if (!later.route || laterPath.includes(":") || laterPath.includes("*")) continue;
                const methods = Object.keys(earlier.route.methods).filter((method) => later.route.methods[method]);
                if (methods.length && earlier.regexp.test(laterPath)) {
                    conflicts.push(`${methods.join(",")} ${earlier.route.path} shadows ${laterPath}`);
                }
            }
        }
    }
    assert.deepEqual(conflicts, []);
});

test("OpenAPI publishes canonical paths, public auth security, and complete path parameters", () => {
    assert.ok(openapi.paths["/repair-jobs"]);
    assert.equal(openapi.paths["/repairjobs"], undefined);
    assert.deepEqual(openapi.paths["/customers/login"].post.security, []);
    assert.deepEqual(openapi.paths["/customers/password-reset/request"].post.security, []);

    for (const [path, pathItem] of Object.entries(openapi.paths)) {
        const templateNames = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
        if (!templateNames.length) continue;
        for (const [method, operation] of Object.entries(pathItem)) {
            if (method === "parameters") continue;
            const parameters = [...(pathItem.parameters || []), ...(operation.parameters || [])];
            for (const name of templateNames) {
                assert.ok(
                    parameters.some((parameter) => parameter.in === "path" && parameter.name === name && parameter.required === true),
                    `${method.toUpperCase()} ${path} must declare path parameter ${name}`,
                );
            }
        }
    }
});
