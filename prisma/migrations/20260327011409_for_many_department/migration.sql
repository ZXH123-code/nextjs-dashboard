-- AlterTable
ALTER TABLE "crm_customer_assignees" ADD COLUMN     "department_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- AlterTable
ALTER TABLE "crm_customers" ADD COLUMN     "department_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- AlterTable
ALTER TABLE "crm_lead_assignees" ADD COLUMN     "department_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- AlterTable
ALTER TABLE "crm_leads" ADD COLUMN     "department_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- AlterTable
ALTER TABLE "crm_opportunities" ADD COLUMN     "department_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- AlterTable
ALTER TABLE "crm_opportunity_assignees" ADD COLUMN     "department_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "department_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- CreateTable
CREATE TABLE "department" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "department_name_key" ON "department"("name");

-- CreateIndex
CREATE INDEX "crm_customer_assignees_department_id_idx" ON "crm_customer_assignees"("department_id");

-- CreateIndex
CREATE INDEX "crm_customers_department_id_idx" ON "crm_customers"("department_id");

-- CreateIndex
CREATE INDEX "crm_lead_assignees_department_id_idx" ON "crm_lead_assignees"("department_id");

-- CreateIndex
CREATE INDEX "crm_leads_department_id_idx" ON "crm_leads"("department_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_department_id_idx" ON "crm_opportunities"("department_id");

-- CreateIndex
CREATE INDEX "crm_opportunity_assignees_department_id_idx" ON "crm_opportunity_assignees"("department_id");

-- CreateIndex
CREATE INDEX "users_department_id_idx" ON "users"("department_id");

-- Seed default department row for existing records
INSERT INTO "department" ("id", "name")
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, '销售部')
ON CONFLICT ("id") DO NOTHING;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_assignees" ADD CONSTRAINT "crm_lead_assignees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunity_assignees" ADD CONSTRAINT "crm_opportunity_assignees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_assignees" ADD CONSTRAINT "crm_customer_assignees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customers" ADD CONSTRAINT "crm_customers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
