-- CreateTable
CREATE TABLE "crm_opportunity_assignees" (
    "opportunity_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_opportunity_assignees_pkey" PRIMARY KEY ("opportunity_id","user_id")
);

-- CreateTable
CREATE TABLE "crm_customer_assignees" (
    "customer_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_customer_assignees_pkey" PRIMARY KEY ("customer_id","user_id")
);

-- CreateIndex
CREATE INDEX "crm_opportunity_assignees_user_id_idx" ON "crm_opportunity_assignees"("user_id");

-- CreateIndex
CREATE INDEX "crm_opportunity_assignees_opportunity_id_idx" ON "crm_opportunity_assignees"("opportunity_id");

-- CreateIndex
CREATE INDEX "crm_customer_assignees_user_id_idx" ON "crm_customer_assignees"("user_id");

-- CreateIndex
CREATE INDEX "crm_customer_assignees_customer_id_idx" ON "crm_customer_assignees"("customer_id");

-- AddForeignKey
ALTER TABLE "crm_opportunity_assignees" ADD CONSTRAINT "crm_opportunity_assignees_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunity_assignees" ADD CONSTRAINT "crm_opportunity_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_assignees" ADD CONSTRAINT "crm_customer_assignees_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_assignees" ADD CONSTRAINT "crm_customer_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
