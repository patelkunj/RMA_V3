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

