/*
  Warnings:

  - You are about to drop the column `contactNo` on the `Customer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email,name]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "contactNo",
ADD COLUMN     "contactPersonEmail" TEXT,
ALTER COLUMN "role" SET DEFAULT 'CUSTOMER',
ALTER COLUMN "paymentTerms" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_email_name_key" ON "Organization"("email", "name");
