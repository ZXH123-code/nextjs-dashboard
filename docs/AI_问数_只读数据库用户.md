# AI 问数：只读数据库用户配置

为降低风险，建议为「AI 问数」单独使用一个**仅具备 SELECT 权限**的数据库用户。即使模型或校验异常生成了写操作，数据库也会拒绝执行。

## 1. 在 PostgreSQL 中创建只读用户

在**生产库**和**测试库**各自连接一次，分别执行下面同一套 SQL（仅把 `your_database`、`你的密码` 换成该库的实际值）。

### 方式一：按 schema 批量授权（推荐）

授予 public schema 下当前所有表及今后新建表的 SELECT：

```sql
-- 创建用户（若该库已创建过 crm_readonly 可跳过此句）
CREATE USER crm_readonly WITH PASSWORD '你的密码';

-- 允许连接当前数据库（your_database 改为实际库名，如 neondb）
GRANT CONNECT ON DATABASE your_database TO crm_readonly;

GRANT USAGE ON SCHEMA public TO crm_readonly;

-- 当前已有所有表的 SELECT
GRANT SELECT ON ALL TABLES IN SCHEMA public TO crm_readonly;

-- 今后在 public 下新建的表也自动授予 crm_readonly SELECT
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO crm_readonly;

-- 可选：让该用户连接后默认在 public schema 下查表（避免 search_path 导致找不到表）
ALTER USER crm_readonly SET search_path TO public;
```

### 方式二：逐表授权（最小权限）

仅对 AI 问数会用到的表单独授予 SELECT，新建表后需手动补一条 GRANT：

```sql
-- 创建用户（若该库已创建过 crm_readonly 可跳过此句）
CREATE USER crm_readonly WITH PASSWORD '你的密码';

GRANT CONNECT ON DATABASE your_database TO crm_readonly;
GRANT USAGE ON SCHEMA public TO crm_readonly;

-- 逐表授予 SELECT（与当前 Prisma schema 中的表名一致）
GRANT SELECT ON public.users TO crm_readonly;
GRANT SELECT ON public.email_verification_codes TO crm_readonly;
GRANT SELECT ON public.crm_leads TO crm_readonly;
GRANT SELECT ON public.crm_opportunities TO crm_readonly;
GRANT SELECT ON public.crm_customers TO crm_readonly;
GRANT SELECT ON public.crm_customer_materials TO crm_readonly;
GRANT SELECT ON public.crm_follow_ups TO crm_readonly;
GRANT SELECT ON public.crm_follow_up_images TO crm_readonly;
GRANT SELECT ON public.crm_lead_assignment_notifications TO crm_readonly;

-- 可选：让该用户连接后默认在 public schema 下查表
ALTER USER crm_readonly SET search_path TO public;
```

- **生产库**：在 Neon 控制台或生产库的 SQL 执行窗口跑一遍（库名、密码用生产的）。
- **测试库**：在连到 localhost:5433 的数据库 IDE 里再跑一遍（库名用 `neondb`，密码可设成与生产不同）。

## 2. 配置环境变量

在 `.env` 或 `.env.local` 中增加只读连接串（与现有 `DATABASE_URL` 同库、同主机，仅用户名和密码不同）：

```env
# AI 问数专用：只读用户连接串（可选；不配置则使用默认 DATABASE_URL）
DATABASE_URL_READONLY="postgresql://crm_readonly:你的密码@主机:端口/your_database?schema=public"
```

若使用 Neon 等带连接池的托管库，可沿用同一格式并加 `?sslmode=require` 等参数。

**测试环境小结**：执行完第 1 步 SQL 后，在 **`.env.local`** 中增加一行，指向同一测试库、用户 `crm_readonly`、密码与上面 `CREATE USER` 一致，例如：

```env
DATABASE_URL_READONLY="postgresql://crm_readonly:你的密码@localhost:5433/neondb?schema=public"
```

本地 `pnpm dev` 时 AI 问数会使用该只读连接。若未配置 `DATABASE_URL_READONLY`，开发环境会自动回退到 `DATABASE_URL`（主库），仍可问数但建议生产使用只读账号。

## 3. 行为说明

- 配置了 `DATABASE_URL_READONLY` 时，AI 问数执行生成的 SQL 时使用该只读连接，其它业务仍使用 `DATABASE_URL`。
- 未配置时，AI 问数继续使用默认 `prisma` 连接（与现有行为一致）。

## 4. 相关文档

- [AI_问数_功能说明.md](./AI_问数_功能说明.md) — 功能概述、安全、控制台日志。
- [AI_问数_配置说明.md](./AI_问数_配置说明.md) — AI 模型与 Key 配置。
