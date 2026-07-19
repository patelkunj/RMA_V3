# Production Operations

## Release procedure

1. Install production dependencies with `npm ci --omit=dev`, generate the Prisma client, and scan the dependency manifest.
2. Back up PostgreSQL and verify the latest restore test before schema changes.
3. Run `npm run db:migrate:deploy` as a one-off release job.
4. Deploy the API with readiness checks on `/health/ready` and liveness checks on `/health/live`.
5. Confirm `/metrics`, outbox backlog, failed webhook count, HTTP 5xx rate, latency, and SLA breach rate.
6. Roll back to the previous application release if needed. Database migrations require a reviewed forward-fix migration; never run destructive rollback SQL automatically.

## Required external services

- PostgreSQL with encrypted connections, automated point-in-time recovery, and restricted application credentials.
- ClamAV or an equivalent scanning service when `FILE_SCAN_REQUIRED=true`.
- Private S3 or S3-compatible object storage for all durable uploads. Set `UPLOAD_STORAGE_PROVIDER=s3`; local storage is rejected at production startup. Keep the bucket private, enable versioning/lifecycle policies as appropriate, and grant only object-level access to the application workload role.
- A secrets manager for JWT, encryption, email, metrics, and database credentials.

## Backup and restore

- Run encrypted daily full backups and continuous WAL archiving.
- Keep backups in a separate account or failure domain.
- Perform and record a restore test at least monthly.
- Restore into an isolated database, run `prisma migrate status`, validate row counts and tenant boundaries, then run smoke tests before promotion.
- Set recovery point and recovery time objectives with the business; application code cannot define these alone.

## Monitoring and alerts

Scrape `/metrics` using the `METRICS_TOKEN`. Alert on readiness failures, sustained 5xx responses, latency, database saturation, disk usage, failed outbox events, webhook failure growth, upload scanner unavailability, and SLA breaches. Forward structured JSON logs to centralized storage and restrict access because actor identifiers are present.

## Data protection

- Runtime uploads are private objects and must only be returned by authenticated, tenant-scoped download handlers. Temporary Multer staging files must be short-lived and excluded from backups.
- Organization logos accept PNG or JPEG content up to 2 MB, are integrity checked on retrieval, and are embedded in invoice and service-report PDFs with text-branding fallback.
- Device credentials are encrypted and retrieved through an audited endpoint.
- Refresh, activation, reset, and API tokens are stored as hashes; webhook signing secrets are encrypted.
- Cookie-authenticated writes use double-submit CSRF protection, and TOTP MFA with one-time recovery codes is available to internal and customer accounts.
- Privacy exports and erasure requests are available through `/api/v1/privacy`. Erasure is intentionally approval-based and must follow legal retention requirements.
- Define document, audit, invoice, and customer-data retention periods with legal and finance stakeholders before automating deletion.

## Scaling

Set `RATE_LIMIT_STORE=postgres` for multiple API instances. The database outbox uses conditional claiming so multiple workers can run. Use a dedicated worker deployment at higher volume and disable in-process workers on web replicas. Use sticky-free load balancing; sessions are database-backed.
