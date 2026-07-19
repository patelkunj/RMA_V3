/*
  Warnings:

  - The values [TAX] on the enum `CostType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CostType_new" AS ENUM ('PART', 'LABOR', 'SHIPPING', 'REPLACEMENT', 'CREDIT_NOTE', 'REPAIR');
ALTER TABLE "RepairJobCosting" ALTER COLUMN "costType" TYPE "CostType_new" USING ("costType"::text::"CostType_new");
ALTER TYPE "CostType" RENAME TO "CostType_old";
ALTER TYPE "CostType_new" RENAME TO "CostType";
DROP TYPE "public"."CostType_old";
COMMIT;
