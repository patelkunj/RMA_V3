# RMA V3 Backend

Node.js / Express REST API for an RMA, reverse logistics, and repair workflow. The API uses Prisma ORM with PostgreSQL and includes authentication, customer/user management, repair jobs, serial numbers, products, comments, chats, costings, and operational reports.

## Tech Stack

- Node.js with Express
- PostgreSQL
- Prisma ORM
- JWT authentication
- Multer file uploads
- Node's built-in `node:test` runner

## Project Structure

```text
src/
  app.js                    Express app, middleware, route mounting
  db/                       Database clients
  controllers/              Thin HTTP request/response handlers
  services/                 Business logic and Prisma operations
  routes/                   Express routers and route middleware
  middlewares/              Auth, authorization, security, rate limits, uploads
  utils/                    Shared helpers, validation, logging, responses
  templates/                Email templates
prisma/
  schema.prisma             Prisma schema
  migrations/               Database migrations
  seed_pgadmin_test_data.sql Test seed data
postman/
  RMA_V3_API.postman_collection.json
test/
  *.test.js
```

## Prerequisites

- Node.js 22+
- PostgreSQL
- npm

## Environment Setup

Copy the example env file:

```bash
cp .env.example .env
```

Update the important values:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/rma_v3
CORS_ORIGIN=http://localhost:5173
APP_URL=http://localhost:3000
ACCESS_TOKEN_SECRET=replace-with-a-long-random-secret
REFRESH_TOKEN_SECRET=replace-with-a-different-long-random-secret
EMAILUSER=your-email@example.com
EMAILPASSWORD=your-email-app-password
```

## Install

```bash
npm install
```

## Database

Validate the Prisma schema:

```bash
npm run prisma:validate
```

Generate Prisma client:

```bash
npm run prisma:generate
```

Apply migrations in development:

```bash
npx prisma migrate dev
```

For an existing database where migrations are already applied, use the appropriate Prisma workflow for your environment.

## Seed Test Data

A PostgreSQL seed script is available for local testing:

```bash
npx prisma db execute --file prisma/seed_pgadmin_test_data.sql --schema prisma/schema.prisma
```

Seed login:

```text
seed.superadmin@example.test
Password123!
```

The seed data includes organizations, users, customers, products, serial numbers, repair jobs across multiple statuses, costings, comments, chats, documents, notifications, logs, and sessions.

## Run

Development:

```bash
npm run dev
```

Production-style start:

```bash
npm start
```

Default local URL:

```text
http://localhost:3000
```

## Verify

Run the full project verification:

```bash
npm run verify
```

This runs:

- Prisma schema validation
- JavaScript syntax checks
- Test suite

Individual commands:

```bash
npm run prisma:validate
npm run syntax:check
npm test
```

## Production capabilities

The API now includes customer RMA intake and review, technician assignment, an enforced repair state machine, SLA monitoring, inspection/diagnosis/repair/QA work logs, estimates and customer approval, inventory movements, shipment tracking, persistent invoices and payments, tenant configuration and private organization logos used in generated PDFs, API keys and signed webhooks, a transactional outbox, idempotency protection, notification preferences and SSE delivery, privacy workflows, private document downloads, health/readiness checks, metrics, durable rate limiting, and graceful shutdown.

Apply the production migration before deploying:

```bash
npm run prisma:generate
npm run db:migrate:deploy
```

The API contract is served at `/api-docs/openapi.json`. Operational guidance, backups, monitoring, scaling, and release procedures are documented in `docs/production.md`.

Organization administrators can upload a PNG or JPEG logo (maximum 2 MB) with `PUT /api/v1/organizations/:id/logo`. Logos are tenant-scoped, privately stored, and rendered on invoice and service-report PDFs. Authenticated tenant actors can retrieve the logo from `GET /api/v1/organizations/:id/logo`.

State-changing creation/payment/import endpoints require an `Idempotency-Key` header. Browser clients using authentication cookies must echo the readable `csrfToken` cookie in `X-CSRF-Token`; bearer-token clients do not require the CSRF header. Internal users and customers can enable TOTP MFA under `/api/v1/mfa`.

Customer login and password-reset initiation require `organizationId` together with the normalized customer email. This is required because customer email addresses are unique within an organization rather than globally. Use `POST /api/v1/customers/password-reset/request`; the legacy `/getCustomerDetail` alias remains available temporarily with the same tenant-aware body.

## Postman

Import this collection into Postman:

```text
postman/RMA_V3_API.postman_collection.json
```

Recommended flow:

1. Set `baseUrl` to your API URL, for example `http://localhost:3000`.
2. Run `Users / Login User`.
3. The collection stores `accessToken` automatically.
4. Run protected requests.

The collection uses seeded IDs such as:

```text
organizationId = 9001
customerId = 9401
productId = 9201
repairJobId = 9102
```

## Main API Areas

Base path:

```text
/api/v1
```

Mounted routers:

```text
/users
/customers
/organizations
/products
/serialnumbers
/repairjobs
/repairjobcost
/chats
/comments
/reports
/notifications
/documents
/repairjob-timeline
/sessions
```

Some legacy route names are still supported for frontend compatibility. New route work should prefer REST-style, lowercase, kebab-case paths.

## Reports

Reports are available under:

```text
/api/v1/reports
```

Current reports:

- `/summary`
- `/backlog`
- `/throughput`
- `/costs`
- `/products`
- `/customers`
- `/service-report/:repairJobId.pdf`
- `/invoice/:repairJobId.pdf`

Reports support query or body filters such as:

```json
{
  "startDate": "2026-01-01",
  "endDate": "2026-12-31",
  "organizationId": 9001,
  "customerId": 9401,
  "page": 1,
  "limit": 20
}
```

## Added Operational APIs

New supporting API areas:

- `/api/v1/sessions`: refresh user access tokens, list sessions, revoke one session, or revoke all sessions.
- `/api/v1/notifications`: list the signed-in recipient's notifications, create manual admin notifications, mark read, and fetch unread count. Chat notifications are generated automatically when a chat message or attachment is created.
- `/api/v1/documents`: list, inspect, download, and deactivate repair-job documents with repair-job access checks.
- `/api/v1/repairjob-timeline`: fetch repair-job audit logs and status tracking history.
- `/api/v1/reports/service-report/:repairJobId.pdf`: download a repair-job service report PDF.
- `/api/v1/reports/invoice/:repairJobId.pdf`: download a repair-job invoice PDF.
- `POST /api/v1/reports/invoice/:repairJobId/email`: email the customer a billing message with the generated PDF invoice attached (Admin/Super Admin).

Account activation, password reset, repair-status, and billing emails share the responsive RMA email layout in `src/templates/email.templates.js`. Set `CUSTOMER_PORTAL_URL` for repair-job links and configure the `EMAIL_*` and `INVOICE_*` variables documented in `.env.example`.

## Code Conventions

- Keep controllers thin.
- Put business logic and Prisma queries in `src/services/`.
- Use Prisma directly; do not recreate legacy model classes.
- Use `ApiResponse` and `ApiError` for response consistency.
- Use `verifyJWT` and `authorizeRoles` on protected routes.
- Add `authRateLimit` to public auth endpoints.
- Add `uploadRateLimit` before multer on upload endpoints.
- Scope tenant data access by organization/customer/product/repair job.
- Use `select` to avoid returning passwords, tokens, and other sensitive fields.
- Use transactions when a use case writes multiple related records.

More detailed contributor rules are in:

```text
AGENTS.md
```

## Security Notes

- Never commit `.env` or secrets.
- Never log passwords, JWTs, reset tokens, activation tokens, cookies, request bodies, or uploaded file contents.
- Use `src/utils/logger.js` for application logging.
- Keep `LOG_TO_FILE=false` in cloud deployments unless local file logging is specifically required.

## File Uploads

Private uploads are stored through the configured storage provider. Production requires `UPLOAD_STORAGE_PROVIDER=s3`, a private S3 or S3-compatible bucket, and workload-role credentials (preferred) or an explicit access-key pair. Objects are encrypted server-side and are returned only through authenticated, tenant-scoped download endpoints. Local development and tests may use `UPLOAD_STORAGE_PROVIDER=local`, which stores private objects under `var/private-uploads`. Multer request staging remains under `public/temp`; neither location is committed.

Upload routes must use:

- Auth middleware
- Authorization middleware
- Upload rate limiting
- Multer middleware
- Request-scoped file movement

## Testing Notes

Tests use Node's built-in test runner:

```bash
npm test
```

The customer tenant-authentication and critical-operations integration tests require a dedicated PostgreSQL test database and refuse database names that do not contain `test` or `integration`:

```bash
RUN_DB_INTEGRATION_TESTS=true \
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rma_test \
node --test test/*.integration.test.js
```

The critical suite covers billing/payment precision and locking, inventory reservation locking, repair workflow transitions, private uploads, tenant permissions, and per-endpoint outbox retries. CI enables these tests after applying all Prisma migrations. Ordinary local test runs skip their database operations.

Prefer deterministic tests that do not require a live production database.
