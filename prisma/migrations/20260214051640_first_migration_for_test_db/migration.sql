-- Prisma 校验迁移时会建 shadow database，也需先启用 uuid 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" VARCHAR(20) DEFAULT 'sales',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_codes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" VARCHAR(255) NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "purpose" VARCHAR(20) NOT NULL DEFAULT 'signup',
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_leads" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "customer_name" VARCHAR(255) NOT NULL,
    "nickname" VARCHAR(100),
    "contact_person" VARCHAR(100),
    "contact_email" VARCHAR(255),
    "city" VARCHAR(100),
    "address" VARCHAR(500),
    "industry" VARCHAR(100),
    "lead_source" VARCHAR(100),
    "contact_phone" VARCHAR(20),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_tier" VARCHAR(50),
    "remark" VARCHAR(500),
    "sales_person_id" UUID,
    "status" VARCHAR(50) NOT NULL DEFAULT '未跟进',
    "is_key_focus" BOOLEAN NOT NULL DEFAULT false,
    "key_focus_by_admin" BOOLEAN NOT NULL DEFAULT false,
    "import_source" VARCHAR(100),
    "extra_fields" JSONB,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_opportunities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "lead_id" UUID,
    "product_type" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL DEFAULT '初步沟通',
    "amount" DECIMAL(12,2),
    "contact_phone" VARCHAR(20),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_close_date" DATE,
    "sales_person_id" UUID,
    "delivery_person_id" UUID,
    "lost_reason" VARCHAR(500),
    "is_key_focus" BOOLEAN NOT NULL DEFAULT false,
    "key_focus_by_admin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "crm_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_customers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "nickname" VARCHAR(100),
    "city" VARCHAR(100),
    "first_maintenance_date" DATE,
    "status" VARCHAR(50) NOT NULL DEFAULT '已签约',
    "industry" VARCHAR(100),
    "employee_count" VARCHAR(50),
    "tags" VARCHAR(500),
    "main_products" VARCHAR(500),
    "contact_phone" VARCHAR(20),
    "opportunity_id" UUID,
    "actual_amount" DECIMAL(12,2),
    "sales_person_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_key_focus" BOOLEAN NOT NULL DEFAULT false,
    "key_focus_by_admin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "crm_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_customer_materials" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "customer_id" UUID NOT NULL,
    "blob_url" VARCHAR(1024) NOT NULL,
    "pathname" VARCHAR(512),
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "content_type" VARCHAR(128),
    "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by_id" UUID,

    CONSTRAINT "crm_customer_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_follow_ups" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "content" TEXT NOT NULL,
    "follow_up_by_id" UUID NOT NULL,
    "follow_date" DATE NOT NULL,
    "contact_person" VARCHAR(100),
    "summary" VARCHAR(500),
    "next_step" VARCHAR(500),
    "customer_needs" VARCHAR(500),
    "status" VARCHAR(50),
    "lead_id" UUID,
    "customer_id" UUID,
    "opportunity_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6),
    "updated_by_id" UUID,
    "is_system_generated" BOOLEAN NOT NULL DEFAULT false,
    "transition_type" VARCHAR(32),

    CONSTRAINT "crm_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_follow_up_images" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "follow_up_id" UUID NOT NULL,
    "blob_url" VARCHAR(1024) NOT NULL,
    "pathname" VARCHAR(512),
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "content_type" VARCHAR(128),
    "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_follow_up_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_assignment_notifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "lead_id" UUID NOT NULL,
    "change_type" VARCHAR(20) NOT NULL,
    "old_sales_person_id" UUID,
    "new_sales_person_id" UUID,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "notified_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "crm_lead_assignment_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "email_verification_codes_email_purpose_idx" ON "email_verification_codes"("email", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_codes_email_purpose_key" ON "email_verification_codes"("email", "purpose");

-- CreateIndex
CREATE INDEX "crm_leads_status_idx" ON "crm_leads"("status");

-- CreateIndex
CREATE INDEX "crm_leads_sales_person_id_idx" ON "crm_leads"("sales_person_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_opportunities_lead_id_key" ON "crm_opportunities"("lead_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_status_idx" ON "crm_opportunities"("status");

-- CreateIndex
CREATE INDEX "crm_opportunities_sales_person_id_idx" ON "crm_opportunities"("sales_person_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_lead_id_idx" ON "crm_opportunities"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_customers_opportunity_id_key" ON "crm_customers"("opportunity_id");

-- CreateIndex
CREATE INDEX "crm_customers_status_idx" ON "crm_customers"("status");

-- CreateIndex
CREATE INDEX "crm_customers_sales_person_id_idx" ON "crm_customers"("sales_person_id");

-- CreateIndex
CREATE INDEX "crm_customers_opportunity_id_idx" ON "crm_customers"("opportunity_id");

-- CreateIndex
CREATE INDEX "crm_customers_created_at_idx" ON "crm_customers"("created_at");

-- CreateIndex
CREATE INDEX "crm_customer_materials_customer_id_idx" ON "crm_customer_materials"("customer_id");

-- CreateIndex
CREATE INDEX "crm_follow_ups_lead_id_idx" ON "crm_follow_ups"("lead_id");

-- CreateIndex
CREATE INDEX "crm_follow_ups_customer_id_idx" ON "crm_follow_ups"("customer_id");

-- CreateIndex
CREATE INDEX "crm_follow_ups_opportunity_id_idx" ON "crm_follow_ups"("opportunity_id");

-- CreateIndex
CREATE INDEX "crm_follow_ups_follow_date_idx" ON "crm_follow_ups"("follow_date");

-- CreateIndex
CREATE INDEX "crm_follow_ups_created_at_idx" ON "crm_follow_ups"("created_at");

-- CreateIndex
CREATE INDEX "crm_follow_up_images_follow_up_id_idx" ON "crm_follow_up_images"("follow_up_id");

-- CreateIndex
CREATE INDEX "crm_lead_assignment_notifications_lead_id_idx" ON "crm_lead_assignment_notifications"("lead_id");

-- CreateIndex
CREATE INDEX "crm_lead_assignment_notifications_old_sales_person_id_idx" ON "crm_lead_assignment_notifications"("old_sales_person_id");

-- CreateIndex
CREATE INDEX "crm_lead_assignment_notifications_new_sales_person_id_idx" ON "crm_lead_assignment_notifications"("new_sales_person_id");

-- CreateIndex
CREATE INDEX "crm_lead_assignment_notifications_notified_idx" ON "crm_lead_assignment_notifications"("notified");

-- CreateIndex
CREATE INDEX "crm_lead_assignment_notifications_created_at_idx" ON "crm_lead_assignment_notifications"("created_at");

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_sales_person_id_fkey" FOREIGN KEY ("sales_person_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_sales_person_id_fkey" FOREIGN KEY ("sales_person_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_delivery_person_id_fkey" FOREIGN KEY ("delivery_person_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customers" ADD CONSTRAINT "crm_customers_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customers" ADD CONSTRAINT "crm_customers_sales_person_id_fkey" FOREIGN KEY ("sales_person_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_materials" ADD CONSTRAINT "crm_customer_materials_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_materials" ADD CONSTRAINT "crm_customer_materials_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_follow_ups" ADD CONSTRAINT "crm_follow_ups_follow_up_by_id_fkey" FOREIGN KEY ("follow_up_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_follow_ups" ADD CONSTRAINT "crm_follow_ups_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_follow_ups" ADD CONSTRAINT "crm_follow_ups_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_follow_ups" ADD CONSTRAINT "crm_follow_ups_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_follow_ups" ADD CONSTRAINT "crm_follow_ups_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_follow_up_images" ADD CONSTRAINT "crm_follow_up_images_follow_up_id_fkey" FOREIGN KEY ("follow_up_id") REFERENCES "crm_follow_ups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_assignment_notifications" ADD CONSTRAINT "crm_lead_assignment_notifications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_assignment_notifications" ADD CONSTRAINT "crm_lead_assignment_notifications_old_sales_person_id_fkey" FOREIGN KEY ("old_sales_person_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_assignment_notifications" ADD CONSTRAINT "crm_lead_assignment_notifications_new_sales_person_id_fkey" FOREIGN KEY ("new_sales_person_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_assignment_notifications" ADD CONSTRAINT "crm_lead_assignment_notifications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
