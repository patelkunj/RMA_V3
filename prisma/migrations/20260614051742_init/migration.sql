/*
  Warnings:

  - You are about to drop the `Organizations` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('CREATED', 'RECEIVED', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Resolution" AS ENUM ('REPLACEMENT', 'REPAIR', 'CREDIT');

-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('PART', 'LABOR', 'SHIPPING', 'REPLACEMENT', 'CREDIT_NOTE', 'TAX');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'COMMENT', 'CONTACT', 'COST_CHANGE');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('USER', 'CUSTOMER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('IMAGE', 'PDF', 'DOC', 'VIDEO', 'OTHER');

-- DropTable
DROP TABLE "Organizations";

-- CreateTable
CREATE TABLE "Organization" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "mobile" TEXT,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "activationToken" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOrganization" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCustomer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "companyName" TEXT NOT NULL,
    "customerCode" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "contactPersonName" TEXT,
    "contactNo" TEXT,
    "mobile" TEXT,
    "role" TEXT NOT NULL DEFAULT 'Customer',
    "returnAddress" TEXT,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 0,
    "warrantyTypes" TEXT,
    "doaWarrantyDays" INTEGER NOT NULL DEFAULT 0,
    "doaWarrantyTypes" TEXT,
    "warrantyRemarks" TEXT,
    "isPickupFaulty" BOOLEAN NOT NULL DEFAULT false,
    "salesPerson" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "creditLimit" DECIMAL(12,2),
    "paymentTerms" INTEGER,
    "activationToken" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairJob" (
    "id" SERIAL NOT NULL,
    "raJobId" TEXT,
    "organizationId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "devicePassword" TEXT,
    "isDoa" BOOLEAN NOT NULL DEFAULT false,
    "isProductUnderWarranty" BOOLEAN NOT NULL DEFAULT false,
    "cloudStatus" TEXT,
    "cloudDetails" TEXT,
    "productFault" TEXT NOT NULL,
    "videoUrl" TEXT,
    "customerTrackingNumber" TEXT,
    "dispatchId" TEXT,
    "salesInvoice" TEXT,
    "customerSalesInvoice" TEXT,
    "customerJobNo" TEXT,
    "resolutionType" "Resolution",
    "jobStatus" "JobStatus" NOT NULL DEFAULT 'CREATED',
    "createdBy" INTEGER NOT NULL,
    "createdRoleBy" TEXT NOT NULL,
    "receivedBy" INTEGER,
    "receivedRoleBy" TEXT,
    "receivedDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairJobTracking" (
    "id" SERIAL NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "status" "JobStatus" NOT NULL,
    "changedBy" INTEGER NOT NULL,
    "changedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairJobTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairJobCosting" (
    "id" SERIAL NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "productId" INTEGER,
    "costType" "CostType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "billableToCustomer" BOOLEAN NOT NULL DEFAULT true,
    "customerCharge" DECIMAL(12,2) NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairJobCosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairJobComment" (
    "id" SERIAL NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairJobComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" SERIAL NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "senderRole" "SenderType" NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairJobAuditLog" (
    "id" SERIAL NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "actionType" "AuditAction" NOT NULL,
    "description" TEXT NOT NULL,
    "performedBy" INTEGER NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairJobAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "color" TEXT,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSerial" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "salesInvoice" TEXT NOT NULL,
    "saleDate" DATE NOT NULL,
    "warrantyExpiry" DATE NOT NULL,
    "isReplacementProduct" BOOLEAN NOT NULL DEFAULT false,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSerial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" SERIAL NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "relatedType" TEXT NOT NULL,
    "relatedId" INTEGER NOT NULL,
    "documentName" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "uploadedBy" INTEGER NOT NULL,
    "uploadedRole" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER NOT NULL,
    "actorRole" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "logStatus" TEXT NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionManagement" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionManagement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserOrganization_organizationId_idx" ON "UserOrganization"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserOrganization_userId_organizationId_key" ON "UserOrganization"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "UserCustomer_userId_customerId_idx" ON "UserCustomer"("userId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCustomer_userId_customerId_key" ON "UserCustomer"("userId", "customerId");

-- CreateIndex
CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_customerCode_key" ON "Customer"("organizationId", "customerCode");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_email_key" ON "Customer"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "RepairJob_raJobId_key" ON "RepairJob"("raJobId");

-- CreateIndex
CREATE INDEX "RepairJob_sku_idx" ON "RepairJob"("sku");

-- CreateIndex
CREATE INDEX "RepairJob_productName_idx" ON "RepairJob"("productName");

-- CreateIndex
CREATE INDEX "RepairJob_organizationId_idx" ON "RepairJob"("organizationId");

-- CreateIndex
CREATE INDEX "RepairJob_customerId_idx" ON "RepairJob"("customerId");

-- CreateIndex
CREATE INDEX "RepairJobTracking_repairJobId_idx" ON "RepairJobTracking"("repairJobId");

-- CreateIndex
CREATE INDEX "RepairJobCosting_repairJobId_idx" ON "RepairJobCosting"("repairJobId");

-- CreateIndex
CREATE INDEX "RepairJobCosting_productId_idx" ON "RepairJobCosting"("productId");

-- CreateIndex
CREATE INDEX "RepairJobComment_repairJobId_idx" ON "RepairJobComment"("repairJobId");

-- CreateIndex
CREATE INDEX "RepairJobComment_userId_idx" ON "RepairJobComment"("userId");

-- CreateIndex
CREATE INDEX "Chat_repairJobId_idx" ON "Chat"("repairJobId");

-- CreateIndex
CREATE INDEX "Chat_senderId_senderRole_idx" ON "Chat"("senderId", "senderRole");

-- CreateIndex
CREATE INDEX "RepairJobAuditLog_repairJobId_idx" ON "RepairJobAuditLog"("repairJobId");

-- CreateIndex
CREATE INDEX "RepairJobAuditLog_performedBy_idx" ON "RepairJobAuditLog"("performedBy");

-- CreateIndex
CREATE INDEX "Product_sku_idx" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_sku_key" ON "Product"("organizationId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSerial_serialNumber_key" ON "ProductSerial"("serialNumber");

-- CreateIndex
CREATE INDEX "ProductSerial_organizationId_idx" ON "ProductSerial"("organizationId");

-- CreateIndex
CREATE INDEX "ProductSerial_productId_idx" ON "ProductSerial"("productId");

-- CreateIndex
CREATE INDEX "Document_relatedType_relatedId_idx" ON "Document"("relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "Document_uploadedBy_idx" ON "Document"("uploadedBy");

-- CreateIndex
CREATE INDEX "Document_repairJobId_idx" ON "Document"("repairJobId");

-- CreateIndex
CREATE INDEX "Notification_recipientType_recipientId_isRead_idx" ON "Notification"("recipientType", "recipientId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_referenceType_referenceId_idx" ON "Notification"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "SessionManagement_userId_idx" ON "SessionManagement"("userId");

-- AddForeignKey
ALTER TABLE "UserOrganization" ADD CONSTRAINT "UserOrganization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOrganization" ADD CONSTRAINT "UserOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCustomer" ADD CONSTRAINT "UserCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCustomer" ADD CONSTRAINT "UserCustomer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJob" ADD CONSTRAINT "RepairJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJob" ADD CONSTRAINT "RepairJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJob" ADD CONSTRAINT "RepairJob_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJob" ADD CONSTRAINT "RepairJob_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJobTracking" ADD CONSTRAINT "RepairJobTracking_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJobTracking" ADD CONSTRAINT "RepairJobTracking_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJobCosting" ADD CONSTRAINT "RepairJobCosting_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJobCosting" ADD CONSTRAINT "RepairJobCosting_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJobComment" ADD CONSTRAINT "RepairJobComment_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJobComment" ADD CONSTRAINT "RepairJobComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJobAuditLog" ADD CONSTRAINT "RepairJobAuditLog_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJobAuditLog" ADD CONSTRAINT "RepairJobAuditLog_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSerial" ADD CONSTRAINT "ProductSerial_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSerial" ADD CONSTRAINT "ProductSerial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionManagement" ADD CONSTRAINT "SessionManagement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
