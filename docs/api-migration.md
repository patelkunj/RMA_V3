# API migration guide

This guide describes the canonical API names introduced for the controlled production release. Existing integrations should migrate now; legacy aliases are temporary compatibility routes.

## Deprecation lifecycle

Deprecated routes continue to execute the same authorization and tenant-isolation checks, but their responses include migration headers:

```http
Deprecation: @1784332800
Sunset: Sun, 31 Jan 2027 00:00:00 GMT
Link: </api/v1/replacement-path>; rel="successor-version"
Warning: 299 - "Deprecated API route; use /api/v1/replacement-path"
```

`Deprecation` uses the [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html) structured-date form (`@` followed by Unix seconds), while `Sunset` follows [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594.html). The deployment can override the effective date through `LEGACY_API_DEPRECATION` and the removal date through `LEGACY_API_SUNSET`. Clients should treat the response's `Sunset` value as authoritative and stop calling the legacy route before that date.

When the server can resolve a concrete successor URL, the `Link` header identifies it. The header is omitted when a body-addressed legacy request does not provide enough information to build a valid URL; use the mapping below in that case. Preserve the HTTP method shown in the mapping because a replacement can use a different method from its legacy predecessor.

## JSON response envelope

Canonical JSON endpoints use one top-level envelope:

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Resource fetched successfully.",
  "data": {}
}
```

Errors use the corresponding error contract and never expose internal exception text:

```json
{
  "statusCode": 400,
  "success": false,
  "message": "Request validation failed.",
  "data": null,
  "errors": []
}
```

Canonical paginated collections expose the consistent `data.items` and `data.pagination` fields. During the compatibility window, resource-specific keys and flat pagination fields are also present, for example `data.users`, `data.total`, and `data.totalPages`. New clients should read `items` and `pagination`. Deprecated chat, comment, and document list aliases retain their former bare-array `data` shape until sunset.

PDFs, private-file downloads, organization-logo downloads, metrics, health probes, and server-sent event streams retain their protocol-specific content types rather than using a JSON envelope.

## Canonical resource prefixes

| Canonical prefix | Deprecated prefix |
| --- | --- |
| `/api/v1/products` | `/api/v1/proudcts` |
| `/api/v1/repair-jobs` | `/api/v1/repairjobs` |
| `/api/v1/repair-job-costs` | `/api/v1/repairjobcost` |
| `/api/v1/repair-job-timeline` | `/api/v1/repairjob-timeline` |
| `/api/v1/serial-numbers` | `/api/v1/serialnumbers` |

All endpoint paths below are relative to `/api/v1`.

## Users

| Canonical request | Deprecated request |
| --- | --- |
| `POST /sessions/refresh` | `POST /users/refresh-token` |
| `GET /users/activate/:token` | `GET /users/activeuser/:token` |
| `POST /users/password-reset/request` | `POST /users/getUserDetail` |
| `POST /users/password-reset/:token` | `POST /users/forgetPassword/:token` |
| `PATCH /users/password` | `POST /users/change_password` |
| `POST /users` | `POST /users/register` |
| `GET /users` | `POST /users/list_user` |
| `GET /users/:id` | `POST /users/user`, `POST /users/find` |
| `PUT /users/:id` | `PUT /users`, `PUT /users/update_user` |
| `PATCH /users/:id/status` | `PUT /users/toggle`, `PATCH /users/status` |

Canonical user, customer, and organization status updates accept an explicit `{ "isActive": true | false }` body and are safe to retry. Deprecated toggle routes may omit `isActive` to retain their former toggle behavior.

## Customers

| Canonical request | Deprecated request |
| --- | --- |
| `GET /customers/activate/:token` | `GET /customers/activecustomer/:token` |
| `POST /customers/password-reset/request` | `POST /customers/getCustomerDetail` |
| `POST /customers/password-reset/:token` | `POST /customers/forgetPassword/:token` |
| `PATCH /customers/password` | `POST /customers/change_password` |
| `GET /customers/by-email?email=...` | `POST /customers/customerinfo` |
| `POST /customers` | `POST /customers/register` |
| `GET /customers` | `POST /customers/list` |
| `GET /customers/search?searchTerm=...` | `POST /customers/search` |
| `GET /customers/:id` | `POST /customers/find` |
| `PUT /customers/:id` | `PUT /customers`, `PUT /customers/update` |
| `PATCH /customers/:id/status` | `PUT /customers/activate_deactivate`, `PATCH /customers/status` |

Customer login and password-reset initiation still require both `organizationId` and normalized `email` because customer email addresses are tenant-scoped.

## Organizations, products, and serial numbers

| Canonical request | Deprecated request |
| --- | --- |
| `PUT /organizations/:id` | `PUT /organizations` |
| `PATCH /organizations/:id/status` | `PATCH /organizations/toggle`, `PATCH /organizations/status` |
| `GET /products/search?keyword=...` | `POST /products/search` |
| `PUT /products/:id` | `PUT /products` |
| `PUT /serial-numbers/:id` | `PUT /serialnumbers`, `PUT /serial-numbers` |
| `POST /serial-numbers/upload` | `POST /serialnumbers/upload_serialnumber`, `POST /serial-numbers/upload_serialnumber` |

The canonical collection uses `/products`, `/serial-numbers`, and ID path parameters. The misspelled `/proudcts` prefix remains only for temporary compatibility.

## Repair jobs

| Canonical request | Deprecated request |
| --- | --- |
| `GET /repair-jobs?status=...&page=...&limit=...` | `POST /repairjobs/list_repairjob` |
| `POST /repair-jobs` | `POST /repairjobs/add_repairjob` |
| `POST /repair-jobs/bulk` | `POST /repairjobs/add_multipal_repairjob` |
| `POST /repair-jobs/serial-number-lookup` | `POST /repairjobs/serial_number_lookup` |
| `GET /repair-jobs/:id` | `POST /repairjobs/repairJob`, `POST /repairjobs/find` |
| `PATCH /repair-jobs/:id/tracking-number` | `PUT /repairjobs/updateTrackingNumber`, `PATCH /repairjobs/tracking-number` |
| `PATCH /repair-jobs/:id/sku` | `PUT /repairjobs/updateSKU`, `PATCH /repairjobs/sku` |
| `PATCH /repair-jobs/:id/serial-number` | `PUT /repairjobs/updateSerialNumber`, `PATCH /repairjobs/serial-number` |
| `PATCH /repair-jobs/:id/status` | `PUT /repairjobs/updateStatus`, `PATCH /repairjobs/status` |
| `PATCH /repair-jobs/:id/dispatch-id` | `PUT /repairjobs/updateDispatchId`, `PATCH /repairjobs/dispatch-id` |
| `PATCH /repair-jobs/:id/receive` | `PUT /repairjobs/receivejob`, `PATCH /repairjobs/receive` |

The workflow endpoints under `/repair-jobs/:id`, including assignment, work logs, estimates, workflow detail, and device credentials, retain their existing resource-oriented suffixes.

## Chats, comments, and repair costs

| Canonical request | Deprecated request |
| --- | --- |
| `GET /chats/repair-jobs/:repairJobId` | `POST /chats/list` |
| `POST /chats/repair-jobs/:repairJobId` | `POST /chats`, `POST /chats/create` |
| `PATCH /chats/repair-jobs/:repairJobId/read` | `PATCH /chats/read`, `PUT /chats/toggle-read` |
| `GET /chats/repair-jobs/:repairJobId/unread-count` | `POST /chats/unread-count` |
| `GET /comments/repair-jobs/:repairJobId` | `POST /comments/list` |
| `POST /comments/repair-jobs/:repairJobId` | `POST /comments`, `POST /comments/create` |
| `PATCH /comments/:id` | `PUT /comments`, `PUT /comments/update` |
| `GET /repair-job-costs?repairJobId=...` | `POST /repairjobcost/list` |
| `POST /repair-job-costs` | `POST /repairjobcost`, `POST /repairjobcost/add` |
| `PUT /repair-job-costs/:id` | `PUT /repairjobcost`, `PUT /repairjobcost/update` |

## Notifications, documents, sessions, reports, and timeline

| Canonical request | Deprecated request |
| --- | --- |
| `GET /notifications` | `POST /notifications/list` |
| `GET /notifications/unread-count` | `POST /notifications/unread-count` |
| `PATCH /notifications/:id/read` | `PATCH /notifications/read` |
| `GET /notifications/admin` | `GET /notifications/admin/all`, `POST /notifications/admin/list` |
| `POST /notifications/admin` | `POST /notifications` |
| `GET /documents` | `POST /documents/list` |
| `PATCH /documents/:id/deactivate` | `PATCH /documents/deactivate` |
| `DELETE /sessions/:id` | `POST /sessions/revoke` |
| `DELETE /sessions/all` | `POST /sessions/revoke-all` |
| `GET /reports/:report-name` | `POST /reports/:report-name` |
| `GET /reports/repair-jobs/:repairJobId/service-report.pdf` | `GET /reports/service-report/:repairJobId.pdf`, `POST /reports/service-report` |
| `GET /reports/repair-jobs/:repairJobId/invoice.pdf` | `GET /reports/invoice/:repairJobId.pdf`, `POST /reports/invoice` |
| `POST /reports/repair-jobs/:repairJobId/invoice/email` | `POST /reports/invoice/:repairJobId/email` |
| `GET /repair-job-timeline/:repairJobId/audit-logs` | `POST /repairjob-timeline/audit-logs/list` |
| `GET /repair-job-timeline/:repairJobId/tracking` | `POST /repairjob-timeline/tracking/list` |

`POST /repair-job-timeline/audit-logs` remains the canonical audit-log creation endpoint.

## Integrations

| Canonical request | Deprecated request |
| --- | --- |
| `GET /integrations/organizations/:organizationId` | `GET /integrations/:organizationId` |

API-key creation, revocation, webhook creation, and API-key ping retain their existing resource-oriented paths.

## JSON naming convention

Canonical requests use `camelCase` for JSON fields, query parameters, and Postman variables. Database column names and legacy request names do not define the public API convention.

| Canonical name | Deprecated names accepted during migration |
| --- | --- |
| `firstName`, `lastName` | `first_name`, `last_name` |
| `assignedCustomerIds`, `assignedOrganizationIds` | `assignedCustomerId`, `assignedOrgId`, `assignedCustomer`, `assignedOrg` |
| `productName` | `product_name` |
| `organizationId`, `productId` | `organization_id`, `product_id` |
| `repairJobId` | `repair_job_id` |
| `serialNumber` | `serial_number` |
| `salesInvoice`, `saleDate` | `sales_order`, `sales_date` |
| `warrantyExpiry` | `warranty_expriy` |
| `isReplacementProduct` | `is_replacement` |
| `storeCode`, `companyJobNo` | `store_code`, `company_job_no` |
| `devicePassword`, `productFault` | `device_password`, `product_fault` |
| `isDoa`, `isProductUnderWarranty` | `is_doa`, `is_product_under_warranty` |
| `cloudStatus`, `cloudDetails`, `videoUrl` | `cloud_status`, `cloud_details`, `video_url` |
| `trackingNumber`, `customerTrackingNumber`, `dispatchId` | `tracking_number`, `customer_tracking_number`, `dispatch_id` |
| `costType`, `unitCost`, `isBillable` | `cost_type`, `unit_cost`, `is_billable` |
| `doaWarrantyDays` | `doaArrantyDays` |

Use `id` only for the resource represented by the current URL. Prefer explicit names such as `repairJobId`, `serialNumberId`, and `repairJobCostId` for related resources and client variables.

The canonical bulk repair-job request uses an `items` array with camelCase fields. The legacy `data` batch field remains accepted during migration; attachments still require multipart form data when they are included.

## Client migration checklist

1. Import the current Postman collection and run requests outside the **Legacy Compatibility** folder.
2. Replace deprecated prefixes and action-style paths with the canonical mappings above.
3. Move resource identifiers from request bodies into path parameters where shown.
4. Move list filters and pagination from GET request bodies into query parameters.
5. Send canonical camelCase field names.
6. Confirm successful JSON responses use the standard `statusCode`, `success`, `message`, and `data` envelope.
7. Monitor `Deprecation`, `Sunset`, `Link`, and `Warning` response headers until no legacy traffic remains.
