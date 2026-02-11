# AI 问数：只读数据库用户配置

为降低风险，建议为「AI 问数」单独使用一个**仅具备 SELECT 权限**的数据库用户。即使模型或校验异常生成了写操作，数据库也会拒绝执行。

## 1. 在 PostgreSQL 中创建只读用户

在拥有管理员权限的数据库连接中执行（将 `your_database`、`crm_readonly`、`你的密码` 替换为实际值）：

```sql
-- 创建用户
CREATE USER crm_readonly WITH PASSWORD '你的密码';

-- 允许连接当前数据库
GRANT CONNECT ON DATABASE your_database TO crm_readonly;

-- 使用 public schema（按你项目实际 schema 调整）
GRANT USAGE ON SCHEMA public TO crm_readonly;

-- 仅授予 CRM 相关表的 SELECT（推荐：最小权限）
GRANT SELECT ON users TO crm_readonly;
GRANT SELECT ON crm_leads TO crm_readonly;
GRANT SELECT ON crm_opportunities TO crm_readonly;
GRANT SELECT ON crm_customers TO crm_readonly;
GRANT SELECT ON crm_follow_ups TO crm_readonly;
GRANT SELECT ON crm_follow_up_images TO crm_readonly;
GRANT SELECT ON crm_customer_materials TO crm_readonly;
GRANT SELECT ON crm_lead_assignment_notifications TO crm_readonly;
```

## 2. 配置环境变量

在 `.env` 或 `.env.local` 中增加只读连接串（与现有 `DATABASE_URL` 同库、同主机，仅用户名和密码不同）：

```env
# AI 问数专用：只读用户连接串（可选；不配置则使用默认 DATABASE_URL）
DATABASE_URL_READONLY="postgresql://crm_readonly:你的密码@主机:端口/your_database?schema=public"
```

若使用 Neon 等带连接池的托管库，可沿用同一格式并加 `?sslmode=require` 等参数。

## 3. 行为说明

- 配置了 `DATABASE_URL_READONLY` 时，AI 问数执行生成的 SQL 时使用该只读连接，其它业务仍使用 `DATABASE_URL`。
- 未配置时，AI 问数继续使用默认 `prisma` 连接（与现有行为一致）。

## 4. 相关文档

- [AI_问数_功能说明.md](./AI_问数_功能说明.md) — 功能概述、安全、控制台日志。
- [AI_问数_配置说明.md](./AI_问数_配置说明.md) — AI 模型与 Key 配置。
