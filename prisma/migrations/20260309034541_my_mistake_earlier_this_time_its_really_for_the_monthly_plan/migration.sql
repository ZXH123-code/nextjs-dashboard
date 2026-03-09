-- CreateTable
CREATE TABLE "crm_monthly_plan_leads" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "lead_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_month" VARCHAR(7) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_monthly_plan_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_monthly_plan_leads_user_id_idx" ON "crm_monthly_plan_leads"("user_id");

-- CreateIndex
CREATE INDEX "crm_monthly_plan_leads_plan_month_idx" ON "crm_monthly_plan_leads"("plan_month");

-- CreateIndex
CREATE UNIQUE INDEX "crm_monthly_plan_leads_lead_id_user_id_plan_month_key" ON "crm_monthly_plan_leads"("lead_id", "user_id", "plan_month");

-- AddForeignKey
ALTER TABLE "crm_monthly_plan_leads" ADD CONSTRAINT "crm_monthly_plan_leads_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_monthly_plan_leads" ADD CONSTRAINT "crm_monthly_plan_leads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
