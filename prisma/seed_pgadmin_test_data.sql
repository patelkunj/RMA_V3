-- RMA V3 PostgreSQL seed data for local/dev testing.
-- Run this in pgAdmin 4 after applying Prisma migrations.
--
-- This script is intentionally idempotent for the seeded IDs below.
-- It deletes only records with IDs in the seeded ranges, then inserts fresh data.
-- Password for all seeded users/customers is: Password123!
-- Bcrypt hash generated with cost 10.

BEGIN;

DELETE FROM "SessionManagement" WHERE "userId" BETWEEN 9001 AND 9004;
DELETE FROM "SystemLog" WHERE "actorId" BETWEEN 9001 AND 9004;
DELETE FROM "Notification" WHERE "organizationId" IN (9001, 9002);
DELETE FROM "Document" WHERE "repairJobId" BETWEEN 9101 AND 9112;
DELETE FROM "RepairJobAuditLog" WHERE "repairJobId" BETWEEN 9101 AND 9112;
DELETE FROM "Chat" WHERE "repairJobId" BETWEEN 9101 AND 9112;
DELETE FROM "RepairJobComment" WHERE "repairJobId" BETWEEN 9101 AND 9112;
DELETE FROM "RepairJobCosting" WHERE "repairJobId" BETWEEN 9101 AND 9112;
DELETE FROM "RepairJobTracking" WHERE "repairJobId" BETWEEN 9101 AND 9112;
DELETE FROM "RepairJob" WHERE "id" BETWEEN 9101 AND 9112;
DELETE FROM "ProductSerial" WHERE "id" BETWEEN 9301 AND 9312;
DELETE FROM "Product" WHERE "id" BETWEEN 9201 AND 9206;
DELETE FROM "UserCustomer" WHERE "userId" BETWEEN 9001 AND 9004 OR "customerId" BETWEEN 9401 AND 9404;
DELETE FROM "UserOrganization" WHERE "userId" BETWEEN 9001 AND 9004 OR "organizationId" IN (9001, 9002);
DELETE FROM "Customer" WHERE "id" BETWEEN 9401 AND 9404;
DELETE FROM "User" WHERE "id" BETWEEN 9001 AND 9004;
DELETE FROM "Organization" WHERE "id" IN (9001, 9002);

INSERT INTO "Organization"
    ("id", "name", "alias", "address", "email", "phone", "isActive", "createdDate", "updatedDate")
VALUES
    (9001, 'Acme Reverse Logistics NZ', 'ACM', '12 Logistics Way, Auckland 2013', 'ops.seed.acme@example.test', '+64 9 555 0101', true, NOW() - INTERVAL '180 days', NOW()),
    (9002, 'Southern Repair Depot', 'SRD', '88 Workshop Road, Christchurch 8011', 'ops.seed.srd@example.test', '+64 3 555 0199', true, NOW() - INTERVAL '160 days', NOW());

INSERT INTO "User"
    ("id", "firstName", "lastName", "email", "password", "mobile", "role", "isActive", "isLocked", "lastLoginAt", "createdDate", "updatedDate")
VALUES
    (9001, 'Sam', 'Superadmin', 'seed.superadmin@example.test', '$2b$10$cVCAFiPlM1fe41WsyhSFgOzl4yT3EGAN89HAHlbJvoUXnYSZfw/IC', '+64 21 555 9001', 'SUPER_ADMIN', true, false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '120 days', NOW()),
    (9002, 'Anika', 'Admin', 'seed.admin@example.test', '$2b$10$cVCAFiPlM1fe41WsyhSFgOzl4yT3EGAN89HAHlbJvoUXnYSZfw/IC', '+64 21 555 9002', 'ADMIN', true, false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '110 days', NOW()),
    (9003, 'Tane', 'Technician', 'seed.tech@example.test', '$2b$10$cVCAFiPlM1fe41WsyhSFgOzl4yT3EGAN89HAHlbJvoUXnYSZfw/IC', '+64 21 555 9003', 'TECHNICIAN', true, false, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '100 days', NOW()),
    (9004, 'Mia', 'Repairlead', 'seed.repairlead@example.test', '$2b$10$cVCAFiPlM1fe41WsyhSFgOzl4yT3EGAN89HAHlbJvoUXnYSZfw/IC', '+64 21 555 9004', 'ADMIN', true, false, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '90 days', NOW());

INSERT INTO "UserOrganization"
    ("id", "userId", "organizationId", "createdDate")
VALUES
    (9501, 9002, 9001, NOW() - INTERVAL '100 days'),
    (9502, 9003, 9001, NOW() - INTERVAL '100 days'),
    (9503, 9004, 9002, NOW() - INTERVAL '90 days'),
    (9504, 9003, 9002, NOW() - INTERVAL '80 days');

INSERT INTO "Customer"
    ("id", "organizationId", "companyName", "customerCode", "email", "password", "contactPersonName", "contactPersonEmail", "mobile", "role", "returnAddress", "warrantyMonths", "warrantyTypes", "doaWarrantyDays", "doaWarrantyTypes", "warrantyRemarks", "isPickupFaulty", "salesPerson", "isActive", "isLocked", "creditLimit", "paymentTerms", "lastLoginAt", "createdDate", "updatedDate")
VALUES
    (9401, 9001, 'North City Electronics', 'ACM01', 'seed.northcity@example.test', '$2b$10$cVCAFiPlM1fe41WsyhSFgOzl4yT3EGAN89HAHlbJvoUXnYSZfw/IC', 'Priya Shah', 'priya.seed@example.test', '+64 27 555 1001', 'CUSTOMER', '44 Retail Park, Auckland 0627', 24, 'STANDARD', 14, 'DOA_REPLACEMENT', 'Standard warranty with return-to-base service.', true, 'Anika Admin', true, false, 25000.00, 20, NOW() - INTERVAL '6 days', NOW() - INTERVAL '95 days', NOW()),
    (9402, 9001, 'Harbour Home Tech', 'ACM02', 'seed.harbour@example.test', '$2b$10$cVCAFiPlM1fe41WsyhSFgOzl4yT3EGAN89HAHlbJvoUXnYSZfw/IC', 'Liam Brown', 'liam.seed@example.test', '+64 27 555 1002', 'CUSTOMER', '19 Marina Drive, Tauranga 3110', 12, 'LIMITED', 7, 'INSPECTION_FIRST', 'Accessories excluded unless bundled on invoice.', false, 'Anika Admin', true, false, 15000.00, 14, NOW() - INTERVAL '12 days', NOW() - INTERVAL '88 days', NOW()),
    (9403, 9002, 'South Island Gadgets', 'SRD01', 'seed.southisland@example.test', '$2b$10$cVCAFiPlM1fe41WsyhSFgOzl4yT3EGAN89HAHlbJvoUXnYSZfw/IC', 'Emily Clark', 'emily.seed@example.test', '+64 27 555 1003', 'CUSTOMER', '5 Depot Lane, Dunedin 9016', 18, 'STANDARD', 10, 'DOA_CREDIT', 'Credit option approved for high-volume customer.', true, 'Mia Repairlead', true, false, 30000.00, 30, NOW() - INTERVAL '4 days', NOW() - INTERVAL '75 days', NOW()),
    (9404, 9002, 'Canterbury Camera Co', 'SRD02', 'seed.canterbury@example.test', '$2b$10$cVCAFiPlM1fe41WsyhSFgOzl4yT3EGAN89HAHlbJvoUXnYSZfw/IC', 'Noah Wilson', 'noah.seed@example.test', '+64 27 555 1004', 'CUSTOMER', '71 High Street, Christchurch 8011', 36, 'PREMIUM', 21, 'DOA_REPLACEMENT', 'Premium warranty includes priority assessment.', false, 'Mia Repairlead', true, false, 45000.00, 30, NOW() - INTERVAL '2 days', NOW() - INTERVAL '60 days', NOW());

INSERT INTO "UserCustomer"
    ("id", "userId", "customerId", "createdDate")
VALUES
    (9601, 9002, 9401, NOW() - INTERVAL '90 days'),
    (9602, 9002, 9402, NOW() - INTERVAL '90 days'),
    (9603, 9003, 9401, NOW() - INTERVAL '80 days'),
    (9604, 9003, 9403, NOW() - INTERVAL '80 days'),
    (9605, 9004, 9403, NOW() - INTERVAL '70 days'),
    (9606, 9004, 9404, NOW() - INTERVAL '70 days');

INSERT INTO "Product"
    ("id", "organizationId", "sku", "name", "model", "color", "createdDate", "updatedDate")
VALUES
    (9201, 9001, 'CAM-4K-PRO', '4K Action Camera Pro', 'ACP-400', 'Black', NOW() - INTERVAL '130 days', NOW()),
    (9202, 9001, 'TAB-10-LTE', '10 Inch LTE Tablet', 'TL10', 'Silver', NOW() - INTERVAL '128 days', NOW()),
    (9203, 9001, 'HUB-MESH-3', 'Mesh WiFi Hub 3 Pack', 'MWH-3', 'White', NOW() - INTERVAL '126 days', NOW()),
    (9204, 9002, 'DRN-MINI-2', 'Mini Drone Mark II', 'DM2', 'Graphite', NOW() - INTERVAL '120 days', NOW()),
    (9205, 9002, 'CAM-360-EL', '360 Camera Elite', 'C360E', 'Black', NOW() - INTERVAL '116 days', NOW()),
    (9206, 9002, 'SND-BAR-XL', 'Sound Bar XL', 'SBXL', 'Charcoal', NOW() - INTERVAL '112 days', NOW());

INSERT INTO "ProductSerial"
    ("id", "organizationId", "productId", "serialNumber", "salesInvoice", "saleDate", "warrantyExpiry", "isReplacementProduct", "createdDate")
VALUES
    (9301, 9001, 9201, 'SN-CAM4K-0001', 'INV-ACM-10001', DATE '2026-01-10', DATE '2028-01-10', false, NOW() - INTERVAL '110 days'),
    (9302, 9001, 9201, 'SN-CAM4K-0002', 'INV-ACM-10002', DATE '2026-02-11', DATE '2028-02-11', false, NOW() - INTERVAL '100 days'),
    (9303, 9001, 9202, 'SN-TAB10-0001', 'INV-ACM-10003', DATE '2025-08-08', DATE '2026-08-08', false, NOW() - INTERVAL '98 days'),
    (9304, 9001, 9202, 'SN-TAB10-0002', 'INV-ACM-10004', DATE '2024-05-01', DATE '2025-05-01', false, NOW() - INTERVAL '96 days'),
    (9305, 9001, 9203, 'SN-MESH3-0001', 'INV-ACM-10005', DATE '2026-03-15', DATE '2027-03-15', false, NOW() - INTERVAL '94 days'),
    (9306, 9001, 9203, 'SN-MESH3-R001', 'INV-ACM-10006', DATE '2026-04-15', DATE '2027-04-15', true, NOW() - INTERVAL '92 days'),
    (9307, 9002, 9204, 'SN-DRN2-0001', 'INV-SRD-20001', DATE '2026-01-18', DATE '2027-07-18', false, NOW() - INTERVAL '90 days'),
    (9308, 9002, 9204, 'SN-DRN2-0002', 'INV-SRD-20002', DATE '2025-11-20', DATE '2027-05-20', false, NOW() - INTERVAL '88 days'),
    (9309, 9002, 9205, 'SN-C360E-0001', 'INV-SRD-20003', DATE '2026-02-22', DATE '2029-02-22', false, NOW() - INTERVAL '86 days'),
    (9310, 9002, 9205, 'SN-C360E-R001', 'INV-SRD-20004', DATE '2026-05-01', DATE '2029-05-01', true, NOW() - INTERVAL '84 days'),
    (9311, 9002, 9206, 'SN-SBXL-0001', 'INV-SRD-20005', DATE '2024-09-10', DATE '2027-09-10', false, NOW() - INTERVAL '82 days'),
    (9312, 9002, 9206, 'SN-SBXL-0002', 'INV-SRD-20006', DATE '2026-03-07', DATE '2029-03-07', false, NOW() - INTERVAL '80 days');

INSERT INTO "RepairJob"
    ("id", "raJobId", "organizationId", "customerId", "sku", "productName", "serialNumber", "devicePassword", "isDoa", "isProductUnderWarranty", "cloudStatus", "cloudDetails", "productFault", "videoUrl", "customerTrackingNumber", "dispatchId", "salesInvoice", "customerSalesInvoice", "customerJobNo", "resolutionType", "jobStatus", "createdBy", "createdRoleBy", "receivedBy", "receivedRoleBy", "receivedDate", "dueDate", "completionDate", "createdDate", "updatedDate")
VALUES
    (9101, 'ACM01-09101', 9001, 9401, 'CAM-4K-PRO', '4K Action Camera Pro', 'SN-CAM4K-0001', NULL, false, true, 'SYNCED', 'Cloud account removed by customer.', 'Will not power on after charging overnight.', NULL, 'NZPOST-ACM-9101', NULL, 'INV-ACM-10001', 'CINV-10001', 'NC-RET-001', 'REPAIR', 'COMPLETED', 9002, 'ADMIN', 9003, 'TECHNICIAN', NOW() - INTERVAL '21 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '24 days', NOW() - INTERVAL '8 days'),
    (9102, 'ACM01-09102', 9001, 9401, 'TAB-10-LTE', '10 Inch LTE Tablet', 'SN-TAB10-0001', NULL, false, true, 'NOT_REQUIRED', NULL, 'Touch screen has dead strip on right edge.', NULL, 'NZPOST-ACM-9102', NULL, 'INV-ACM-10003', 'CINV-10009', 'NC-RET-002', NULL, 'IN_PROGRESS', 9002, 'ADMIN', 9003, 'TECHNICIAN', NOW() - INTERVAL '7 days', NOW() + INTERVAL '3 days', NULL, NOW() - INTERVAL '9 days', NOW() - INTERVAL '1 day'),
    (9103, 'ACM02-09103', 9001, 9402, 'HUB-MESH-3', 'Mesh WiFi Hub 3 Pack', 'SN-MESH3-0001', NULL, true, true, 'SYNCED', 'Router reset completed.', 'Unit fails out of box, no WiFi broadcast.', NULL, 'NZPOST-ACM-9103', 'DISP-ACM-3001', 'INV-ACM-10005', 'CINV-10010', 'HHT-DOA-440', 'REPLACEMENT', 'COMPLETED', 9002, 'ADMIN', 9003, 'TECHNICIAN', NOW() - INTERVAL '13 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '15 days', NOW() - INTERVAL '5 days'),
    (9104, 'ACM02-09104', 9001, 9402, 'CAM-4K-PRO', '4K Action Camera Pro', 'SN-CAM4K-0002', NULL, false, true, 'LOCKED', 'Waiting for customer to remove cloud lock.', 'Lens focus hunts continuously.', NULL, 'NZPOST-ACM-9104', NULL, 'INV-ACM-10002', 'CINV-10011', 'HHT-RET-441', NULL, 'WAITING_PARTS', 9002, 'ADMIN', 9003, 'TECHNICIAN', NOW() - INTERVAL '18 days', NOW() - INTERVAL '2 days', NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '2 days'),
    (9105, 'ACM01-09105', 9001, 9401, 'TAB-10-LTE', '10 Inch LTE Tablet', 'SN-TAB10-0002', NULL, false, false, 'NOT_REQUIRED', NULL, 'Battery swollen, out of warranty.', NULL, 'NZPOST-ACM-9105', NULL, 'INV-ACM-10004', 'CINV-10012', 'NC-RET-003', 'CREDIT', 'CANCELLED', 9002, 'ADMIN', 9003, 'TECHNICIAN', NOW() - INTERVAL '30 days', NOW() - INTERVAL '20 days', NULL, NOW() - INTERVAL '35 days', NOW() - INTERVAL '18 days'),
    (9106, 'ACM02-09106', 9001, 9402, 'HUB-MESH-3', 'Mesh WiFi Hub 3 Pack', 'SN-MESH3-R001', NULL, false, true, 'SYNCED', NULL, 'Replacement unit intermittently drops satellite node.', NULL, 'NZPOST-ACM-9106', NULL, 'INV-ACM-10006', 'CINV-10013', 'HHT-RET-442', NULL, 'CREATED', 9002, 'ADMIN', NULL, NULL, NULL, NOW() + INTERVAL '10 days', NULL, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
    (9107, 'SRD01-09107', 9002, 9403, 'DRN-MINI-2', 'Mini Drone Mark II', 'SN-DRN2-0001', NULL, false, true, 'SYNCED', 'Flight logs uploaded.', 'Gimbal vibration after firmware update.', NULL, 'NZPOST-SRD-9107', NULL, 'INV-SRD-20001', 'SINV-20001', 'SIG-RET-900', NULL, 'RECEIVED', 9004, 'ADMIN', 9003, 'TECHNICIAN', NOW() - INTERVAL '4 days', NOW() + INTERVAL '6 days', NULL, NOW() - INTERVAL '6 days', NOW() - INTERVAL '4 days'),
    (9108, 'SRD01-09108', 9002, 9403, 'CAM-360-EL', '360 Camera Elite', 'SN-C360E-0001', NULL, true, true, 'SYNCED', NULL, 'DOA, device overheats during first setup.', NULL, 'NZPOST-SRD-9108', 'DISP-SRD-778', 'INV-SRD-20003', 'SINV-20002', 'SIG-DOA-901', 'REPLACEMENT', 'COMPLETED', 9004, 'ADMIN', 9003, 'TECHNICIAN', NOW() - INTERVAL '25 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '28 days', NOW() - INTERVAL '12 days'),
    (9109, 'SRD02-09109', 9002, 9404, 'SND-BAR-XL', 'Sound Bar XL', 'SN-SBXL-0001', NULL, false, true, 'NOT_REQUIRED', NULL, 'No audio on HDMI ARC input.', NULL, 'NZPOST-SRD-9109', NULL, 'INV-SRD-20005', 'SINV-20003', 'CCC-RET-500', 'REPAIR', 'COMPLETED', 9004, 'ADMIN', 9003, 'TECHNICIAN', NOW() - INTERVAL '45 days', NOW() - INTERVAL '35 days', NOW() - INTERVAL '31 days', NOW() - INTERVAL '48 days', NOW() - INTERVAL '31 days'),
    (9110, 'SRD02-09110', 9002, 9404, 'CAM-360-EL', '360 Camera Elite', 'SN-C360E-R001', NULL, false, true, 'LOCKED', 'Customer account removal requested.', 'Replacement camera has stitching artifacts.', NULL, 'NZPOST-SRD-9110', NULL, 'INV-SRD-20004', 'SINV-20004', 'CCC-RET-501', NULL, 'WAITING_PARTS', 9004, 'ADMIN', 9003, 'TECHNICIAN', NOW() - INTERVAL '14 days', NOW() - INTERVAL '1 day', NULL, NOW() - INTERVAL '17 days', NOW() - INTERVAL '1 day'),
    (9111, 'SRD01-09111', 9002, 9403, 'DRN-MINI-2', 'Mini Drone Mark II', 'SN-DRN2-0002', NULL, false, true, 'SYNCED', 'Crash logs show motor stall.', 'Rear motor does not spin.', NULL, 'NZPOST-SRD-9111', NULL, 'INV-SRD-20002', 'SINV-20005', 'SIG-RET-902', NULL, 'IN_PROGRESS', 9004, 'ADMIN', 9003, 'TECHNICIAN', NOW() - INTERVAL '9 days', NOW() + INTERVAL '1 day', NULL, NOW() - INTERVAL '12 days', NOW() - INTERVAL '2 days'),
    (9112, 'SRD02-09112', 9002, 9404, 'SND-BAR-XL', 'Sound Bar XL', 'SN-SBXL-0002', NULL, false, true, 'NOT_REQUIRED', NULL, 'Remote intermittently fails, main unit OK.', NULL, 'NZPOST-SRD-9112', NULL, 'INV-SRD-20006', 'SINV-20006', 'CCC-RET-502', NULL, 'CREATED', 9004, 'ADMIN', NULL, NULL, NULL, NOW() + INTERVAL '14 days', NULL, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');

INSERT INTO "RepairJobTracking"
    ("id", "repairJobId", "status", "changedBy", "changedDate")
VALUES
    (9701, 9101, 'CREATED', 9002, NOW() - INTERVAL '24 days'),
    (9702, 9101, 'RECEIVED', 9003, NOW() - INTERVAL '21 days'),
    (9703, 9101, 'IN_PROGRESS', 9003, NOW() - INTERVAL '20 days'),
    (9704, 9101, 'COMPLETED', 9003, NOW() - INTERVAL '8 days'),
    (9705, 9102, 'CREATED', 9002, NOW() - INTERVAL '9 days'),
    (9706, 9102, 'RECEIVED', 9003, NOW() - INTERVAL '7 days'),
    (9707, 9102, 'IN_PROGRESS', 9003, NOW() - INTERVAL '4 days'),
    (9708, 9103, 'CREATED', 9002, NOW() - INTERVAL '15 days'),
    (9709, 9103, 'COMPLETED', 9003, NOW() - INTERVAL '5 days'),
    (9710, 9104, 'WAITING_PARTS', 9003, NOW() - INTERVAL '2 days'),
    (9711, 9107, 'RECEIVED', 9003, NOW() - INTERVAL '4 days'),
    (9712, 9111, 'IN_PROGRESS', 9003, NOW() - INTERVAL '2 days');

INSERT INTO "RepairJobCosting"
    ("id", "repairJobId", "productId", "costType", "quantity", "unitCost", "totalCost", "billableToCustomer", "customerCharge", "createdDate", "updatedDate")
VALUES
    (9801, 9101, 9201, 'PART', 1, 38.50, 38.50, true, 59.00, NOW() - INTERVAL '18 days', NOW()),
    (9802, 9101, NULL, 'LABOR', 2, 45.00, 90.00, true, 120.00, NOW() - INTERVAL '17 days', NOW()),
    (9803, 9102, 9202, 'PART', 1, 72.00, 72.00, true, 105.00, NOW() - INTERVAL '3 days', NOW()),
    (9804, 9103, 9203, 'REPLACEMENT', 1, 89.00, 89.00, false, 0.00, NOW() - INTERVAL '5 days', NOW()),
    (9805, 9104, NULL, 'SHIPPING', 1, 12.50, 12.50, true, 18.00, NOW() - INTERVAL '12 days', NOW()),
    (9806, 9105, NULL, 'CREDIT_NOTE', 1, 140.00, 140.00, false, 0.00, NOW() - INTERVAL '20 days', NOW()),
    (9807, 9108, 9205, 'REPLACEMENT', 1, 210.00, 210.00, false, 0.00, NOW() - INTERVAL '12 days', NOW()),
    (9808, 9109, NULL, 'LABOR', 3, 50.00, 150.00, true, 210.00, NOW() - INTERVAL '36 days', NOW()),
    (9809, 9109, 9206, 'PART', 1, 64.00, 64.00, true, 92.00, NOW() - INTERVAL '35 days', NOW()),
    (9810, 9110, 9205, 'PART', 1, 34.00, 34.00, true, 52.00, NOW() - INTERVAL '5 days', NOW()),
    (9811, 9111, 9204, 'PART', 2, 18.00, 36.00, true, 60.00, NOW() - INTERVAL '2 days', NOW()),
    (9812, 9111, NULL, 'LABOR', 1, 55.00, 55.00, true, 85.00, NOW() - INTERVAL '1 day', NOW());

INSERT INTO "RepairJobComment"
    ("id", "repairJobId", "userId", "comment", "isEdited", "createdDate", "updatedDate")
VALUES
    (9901, 9102, 9003, 'Digitizer replacement ordered and job is on bench.', false, NOW() - INTERVAL '3 days', NOW()),
    (9902, 9104, 9003, 'Waiting on lens assembly from supplier.', false, NOW() - INTERVAL '2 days', NOW()),
    (9903, 9110, 9003, 'Cloud lock must be removed before final QA.', false, NOW() - INTERVAL '1 day', NOW()),
    (9904, 9111, 9003, 'Motor pair replacement approved by customer.', false, NOW() - INTERVAL '12 hours', NOW());

INSERT INTO "Chat"
    ("id", "repairJobId", "senderId", "senderRole", "message", "isRead", "createdDate")
VALUES
    (10001, 9102, 9401, 'CUSTOMER', 'Can you confirm if this will be covered under warranty?', true, NOW() - INTERVAL '5 days'),
    (10002, 9102, 9002, 'USER', 'Yes, it is within warranty and inspection has started.', true, NOW() - INTERVAL '4 days'),
    (10003, 9104, 9003, 'USER', 'We are waiting for the replacement lens assembly.', false, NOW() - INTERVAL '2 days'),
    (10004, 9110, 9404, 'CUSTOMER', 'Cloud account has now been removed.', false, NOW() - INTERVAL '8 hours');

INSERT INTO "RepairJobAuditLog"
    ("id", "repairJobId", "actionType", "description", "performedBy", "performedAt")
VALUES
    (10101, 9101, 'CREATE', 'Repair job created from customer return.', 9002, NOW() - INTERVAL '24 days'),
    (10102, 9101, 'STATUS_CHANGE', 'Job completed after power board repair.', 9003, NOW() - INTERVAL '8 days'),
    (10103, 9102, 'STATUS_CHANGE', 'Job moved to in progress.', 9003, NOW() - INTERVAL '4 days'),
    (10104, 9104, 'STATUS_CHANGE', 'Waiting for lens assembly parts.', 9003, NOW() - INTERVAL '2 days'),
    (10105, 9108, 'STATUS_CHANGE', 'DOA replacement dispatched.', 9003, NOW() - INTERVAL '12 days'),
    (10106, 9111, 'COST_CHANGE', 'Motor and labor costs added.', 9003, NOW() - INTERVAL '1 day');

INSERT INTO "Document"
    ("id", "repairJobId", "relatedType", "relatedId", "documentName", "documentUrl", "documentType", "uploadedBy", "uploadedRole", "fileHash", "isActive", "uploadedDate", "updatedDate")
VALUES
    (10201, 9101, 'REPAIR_JOB', 9101, 'fault-photo-9101.jpg', '/uploads/seed/fault-photo-9101.jpg', 'IMAGE', 9002, 'ADMIN', 'seedhash9101', true, NOW() - INTERVAL '23 days', NOW()),
    (10202, 9102, 'REPAIR_JOB', 9102, 'touchscreen-video-9102.mp4', '/uploads/seed/touchscreen-video-9102.mp4', 'VIDEO', 9401, 'CUSTOMER', 'seedhash9102', true, NOW() - INTERVAL '8 days', NOW()),
    (10203, 9108, 'REPAIR_JOB', 9108, 'doa-report-9108.pdf', '/uploads/seed/doa-report-9108.pdf', 'PDF', 9004, 'ADMIN', 'seedhash9108', true, NOW() - INTERVAL '12 days', NOW()),
    (10204, 9111, 'COSTING', 9811, 'motor-quote-9111.pdf', '/uploads/seed/motor-quote-9111.pdf', 'PDF', 9003, 'TECHNICIAN', 'seedhash9111', true, NOW() - INTERVAL '1 day', NOW());

INSERT INTO "Notification"
    ("id", "organizationId", "recipientType", "recipientId", "referenceType", "referenceId", "title", "message", "isRead", "createdDate")
VALUES
    (10301, 9001, 'USER', 9002, 'REPAIR_JOB', 9104, 'Parts waiting', 'CAM-4K-PRO job is overdue and waiting for parts.', false, NOW() - INTERVAL '1 day'),
    (10302, 9001, 'CUSTOMER', 9401, 'REPAIR_JOB', 9102, 'Repair in progress', 'Your tablet repair is currently in progress.', true, NOW() - INTERVAL '3 days'),
    (10303, 9002, 'USER', 9004, 'REPAIR_JOB', 9110, 'Cloud lock update', 'Customer says cloud lock has been removed.', false, NOW() - INTERVAL '8 hours'),
    (10304, 9002, 'CUSTOMER', 9403, 'REPAIR_JOB', 9111, 'Cost added', 'Motor replacement costs have been added for approval.', false, NOW() - INTERVAL '1 day');

INSERT INTO "SystemLog"
    ("id", "actorId", "actorRole", "description", "logStatus", "createdDate")
VALUES
    (10401, 9001, 'SUPER_ADMIN', 'Seed super admin account created.', 'Successful', NOW() - INTERVAL '120 days'),
    (10402, 9002, 'ADMIN', 'Seed report test data loaded for organization 9001.', 'Successful', NOW()),
    (10403, 9004, 'ADMIN', 'Seed report test data loaded for organization 9002.', 'Successful', NOW());

INSERT INTO "SessionManagement"
    ("id", "userId", "ipAddress", "refreshToken", "expiresAt", "createdDate")
VALUES
    (10501, 9001, '127.0.0.1', 'seed-refresh-token-superadmin-do-not-use', NOW() + INTERVAL '7 days', NOW() - INTERVAL '1 day'),
    (10502, 9002, '127.0.0.1', 'seed-refresh-token-admin-do-not-use', NOW() + INTERVAL '7 days', NOW() - INTERVAL '2 days'),
    (10503, 9003, '127.0.0.1', 'seed-refresh-token-tech-do-not-use', NOW() + INTERVAL '7 days', NOW() - INTERVAL '3 hours');

SELECT setval(pg_get_serial_sequence('"Organization"', 'id'), GREATEST((SELECT MAX("id") FROM "Organization"), 1), true);
SELECT setval(pg_get_serial_sequence('"User"', 'id'), GREATEST((SELECT MAX("id") FROM "User"), 1), true);
SELECT setval(pg_get_serial_sequence('"UserOrganization"', 'id'), GREATEST((SELECT MAX("id") FROM "UserOrganization"), 1), true);
SELECT setval(pg_get_serial_sequence('"UserCustomer"', 'id'), GREATEST((SELECT MAX("id") FROM "UserCustomer"), 1), true);
SELECT setval(pg_get_serial_sequence('"Customer"', 'id'), GREATEST((SELECT MAX("id") FROM "Customer"), 1), true);
SELECT setval(pg_get_serial_sequence('"RepairJob"', 'id'), GREATEST((SELECT MAX("id") FROM "RepairJob"), 1), true);
SELECT setval(pg_get_serial_sequence('"RepairJobTracking"', 'id'), GREATEST((SELECT MAX("id") FROM "RepairJobTracking"), 1), true);
SELECT setval(pg_get_serial_sequence('"RepairJobCosting"', 'id'), GREATEST((SELECT MAX("id") FROM "RepairJobCosting"), 1), true);
SELECT setval(pg_get_serial_sequence('"RepairJobComment"', 'id'), GREATEST((SELECT MAX("id") FROM "RepairJobComment"), 1), true);
SELECT setval(pg_get_serial_sequence('"Chat"', 'id'), GREATEST((SELECT MAX("id") FROM "Chat"), 1), true);
SELECT setval(pg_get_serial_sequence('"RepairJobAuditLog"', 'id'), GREATEST((SELECT MAX("id") FROM "RepairJobAuditLog"), 1), true);
SELECT setval(pg_get_serial_sequence('"Product"', 'id'), GREATEST((SELECT MAX("id") FROM "Product"), 1), true);
SELECT setval(pg_get_serial_sequence('"ProductSerial"', 'id'), GREATEST((SELECT MAX("id") FROM "ProductSerial"), 1), true);
SELECT setval(pg_get_serial_sequence('"Document"', 'id'), GREATEST((SELECT MAX("id") FROM "Document"), 1), true);
SELECT setval(pg_get_serial_sequence('"Notification"', 'id'), GREATEST((SELECT MAX("id") FROM "Notification"), 1), true);
SELECT setval(pg_get_serial_sequence('"SystemLog"', 'id'), GREATEST((SELECT MAX("id") FROM "SystemLog"), 1), true);
SELECT setval(pg_get_serial_sequence('"SessionManagement"', 'id'), GREATEST((SELECT MAX("id") FROM "SessionManagement"), 1), true);

COMMIT;
