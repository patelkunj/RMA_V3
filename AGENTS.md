# Agent Rules

These rules apply to all automated coding agents working in this repository.

## Project Context

- This is a Node.js / Express REST API for an RMA system.
- Prisma is the ORM and PostgreSQL is the production database.
- The system handles real customer data, so prioritize correctness, security, tenant isolation, auditability, and maintainability over style-only changes.

## Required Workflow

1. Read the relevant controller, route, middleware, Prisma schema, and utility files before changing behavior.
2. Preserve existing user changes. Do not revert unrelated modified files.
3. Keep changes scoped to the requested task.
4. Prefer existing project patterns unless they are unsafe.
5. After code changes, run:

   ```bash
   npm run verify
   ```

6. If `npm run verify` cannot be run, clearly state why.

## Security Rules

- Never log passwords, JWTs, reset tokens, activation tokens, request bodies, cookies, or uploaded file contents.
- Use `logger` from `src/utils/logger.js`; do not add raw `console.log`.
- Keep tenant isolation checks for organization, customer, product, serial number, and repair job access.
- Use `verifyJWT` and `authorizeRoles` on protected routes.
- Add rate limiting to public auth endpoints and upload endpoints.
- Do not expose internal exception details in production responses.
- Validate and normalize email addresses.
- Enforce strong passwords on password create/change/reset flows.

## Prisma Rules

- Use Prisma models directly, not the legacy hand-written model classes, unless explicitly required.
- Use `select` to avoid returning sensitive fields such as passwords and tokens.
- Use transactions when creating or updating multiple related records.
- Scope queries by tenant access where applicable.
- Add pagination to list endpoints; do not return unbounded tables.
- Validate enum values before passing them to Prisma.

## API Rules

- Keep response format consistent with `ApiResponse` and `ApiError`.
- Return appropriate HTTP status codes.
- Add a 404 response for missing resources rather than leaking authorization details.
- Avoid changing public response shapes unless necessary; document any breaking changes.

## Code Structure Rules

- Keep controllers thin. Controllers should handle request parsing, response formatting, and calling service functions; business rules and Prisma queries should live in `src/services/`.
- Add one service module per business area, for example `src/services/customer.service.js`, `src/services/repairjob.service.js`, or `src/services/report.service.js`.
- Keep shared validation, parsing, formatting, and access helpers in `src/utils/`; do not duplicate helper logic inside controllers.
- Do not introduce or re-create legacy hand-written model classes. Prisma is the data access layer.
- Prefer transactions inside services when a use case writes multiple related records, audit logs, documents, notifications, or cost rows.
- Keep route files focused on URL definitions and middleware composition only; do not add business logic in route files.
- Keep file naming consistent: route files use `*.routes.js`, controllers use `*.controller.js`, services use `*.service.js`, middleware uses `*.middleware.js`, and tests use `*.test.js`.

## Router Rules

- Use `Router()` from Express and export one default router per route file.
- Define role constants near the top of each route file, for example `ADMIN_ROLES`, `INTERNAL_ROLES`, or `CUSTOMER_VISIBLE_ROLES`.
- Use `router.use(verifyJWT, authorizeRoles(...))` when all routes in a file share the same protection. Apply route-level middleware only when roles differ per endpoint.
- Keep public auth endpoints explicitly rate limited with `authRateLimit`.
- Keep upload endpoints protected with `verifyJWT`, `authorizeRoles`, `uploadRateLimit`, and multer middleware in that order.
- Put static routes before dynamic parameter routes, for example `/status` before `/:id`.
- Prefer REST-style routes for new endpoints, such as `GET /`, `POST /`, `PUT /`, `PATCH /status`, and `POST /search`.
- Preserve existing legacy route paths unless the user explicitly approves a breaking change. When improving names, add a cleaner alias and keep the old path temporarily.
- Do not add GET routes that require request-body fields. Refactor the controller/service to read `req.params` or `req.query` first.
- Keep route naming lowercase and kebab-case for new paths, for example `/serial-number-lookup` rather than `/serial_number_lookup` or `/updateSerialNumber`.

## File Upload Rules

- Use multer middleware on upload routes.
- Use request-scoped file movement only; never move all files from a shared temp directory.
- Do not commit runtime uploads. `public/temp/` and `public/uploads/` are ignored for new files.
- Validate file size/type through middleware.

## Logging Rules

- HTTP activity is logged by `activityLogger`.
- Application logs must be structured and go through `logger`.
- Keep `LOG_TO_FILE=false` in container/cloud deployments unless there is a specific local-file logging requirement.

## Testing Rules

- Add or update tests for new utilities, middleware, validation, and business rules.
- Prefer Node's built-in `node:test` runner unless the project intentionally adopts another test framework.
- Keep tests deterministic and avoid requiring a live production database.

## Deployment Rules

- Keep `.env.example` updated when adding required environment variables.
- Do not commit `.env` or secrets.
- Ensure CI runs `npm run verify`.
