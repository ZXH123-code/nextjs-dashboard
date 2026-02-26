-- 线索多负责人迁移：新建 crm_lead_assignees，将 crm_leads.sales_person_id 迁入后删列
--
-- 执行顺序：先在测试环境执行 npx prisma migrate deploy，确认数据无误后再在生产执行。
-- 回滚：需先恢复 crm_leads.sales_person_id 列并重建外键/索引，再从 crm_lead_assignees 写回（仅保留每个 lead 的一条记录）。

-- CreateTable: 线索负责人关联表
CREATE TABLE "crm_lead_assignees" (
    "lead_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_assignees_pkey" PRIMARY KEY ("lead_id","user_id")
);

-- CreateIndex
CREATE INDEX "crm_lead_assignees_user_id_idx" ON "crm_lead_assignees"("user_id");

CREATE INDEX "crm_lead_assignees_lead_id_idx" ON "crm_lead_assignees"("lead_id");

-- AddForeignKey
ALTER TABLE "crm_lead_assignees" ADD CONSTRAINT "crm_lead_assignees_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_lead_assignees" ADD CONSTRAINT "crm_lead_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 数据迁移：将原单负责人写入新表（必须先执行，再删列）
INSERT INTO "crm_lead_assignees" ("lead_id", "user_id", "created_at")
SELECT "id", "sales_person_id", COALESCE("created_at", CURRENT_TIMESTAMP)
FROM "crm_leads"
WHERE "sales_person_id" IS NOT NULL
ON CONFLICT ("lead_id", "user_id") DO NOTHING;

-- 删除 crm_leads 上的外键、索引与列
ALTER TABLE "crm_leads" DROP CONSTRAINT IF EXISTS "crm_leads_sales_person_id_fkey";

DROP INDEX IF EXISTS "crm_leads_sales_person_id_idx";

ALTER TABLE "crm_leads" DROP COLUMN "sales_person_id";
