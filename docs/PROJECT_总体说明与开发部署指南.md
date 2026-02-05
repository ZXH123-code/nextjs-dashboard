## 一、项目总体说明

本项目是一个基于 **Next.js App Router** 的 CRM 仪表盘，围绕销售团队的日常使用场景设计，核心包括：

- **四张主表**：线索、商机、客户、跟进记录
- **从线索池到签约客户的完整流程**：线索 → 商机 → 客户，配合跟进记录沉淀沟通历史
- **角色与权限**：销售总管 (`admin`) 与销售人员 (`sales`) 的数据隔离与管理能力
- **线索批量导入与分配**：通过 Excel 导入线索，并支持批量指定销售+可选邮件通知
- **飞书多维表格配置对照**：可在飞书中搭出相同结构，配合本系统做轻量协同

若想直接从「业务视角」了解怎么用，请先看：

- `CRM_四张表与表单逻辑说明.md`
- `CRM_权限说明.md`

若需要从「技术视角」了解数据设计，请看：

- `CRM_表结构与关系说明.md`
- `PRISMA_GUIDE.md`

---

## 二、目录结构（与主要模块）

只列出与业务和开发较相关的部分：

- `app/`
  - `page.tsx`：首页（登录入口与跳转）
  - `dashboard/`
    - `(overview)/page.tsx`：驾驶舱概览（统计卡片）
    - `crm/`：CRM 全部页面（线索/商机/客户/跟进）
    - `permissions/`：权限管理页（仅 admin 可见）
    - `profile/`：个人资料页（查看当前角色等）
  - `api/`
    - `crm/leads/import/route.ts`：Excel 批量导入线索的 API
  - `lib/`
    - `crm.ts`：CRM 数据层（Prisma 查询与状态流转）
    - `crm-actions.ts`：Server Actions（表单提交逻辑）
    - `crm-constants.ts`：CRM 纯常量（可在客户端直接使用）
    - `email.ts`：邮件发送工具（Resend）
    - 其他：Prisma、auth 等工具
- `auth.ts`：NextAuth 配置与授权逻辑
- `prisma/schema.prisma`：数据库 schema
- `docs/`：项目所有业务/技术文档

---

## 三、本地开发流程

### 1. 安装依赖

项目使用 `pnpm`：

```bash
pnpm install
```

如未安装 `pnpm`：

```bash
npm install -g pnpm
```

### 2. 配置环境变量

根目录 `.env` 中至少需要：

```env
# 数据库
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# 认证
AUTH_SECRET="生成一个随机字符串"
AUTH_TRUST_HOST=1

# （可选）邮件服务 Resend
RESEND_API_KEY="re_xxx"
RESEND_FROM_EMAIL="onboarding@resend.dev"
```

更多关于 `DATABASE_URL` 的坑和排查，可见：

- `DATABASE_URL_客户端组件导入问题排查.md`

### 3. 初始化数据库

开发环境推荐直接推送 schema：

```bash
pnpm db:push
```

如果希望有迁移文件（更适合多人协作）：

```bash
pnpm db:migrate
```

如需查看或手动修改数据：

```bash
pnpm db:studio
```

### 4. 种子数据（可选）

项目附带 seed 脚本，可以快速创建一些用户/示例数据：

```bash
pnpm db:seed
# 或
pnpm seed
```

### 5. 启动开发服务器

```bash
pnpm dev
```

访问 `http://localhost:3000`。

---

## 四、初次登录与角色配置

1. 通过 seed 或手动在数据库中创建至少一个用户（`users` 表）。
2. 在数据库中把其中一个用户的 `role` 设置为 `admin`：

```sql
UPDATE users SET role = 'admin' WHERE email = '管理员邮箱@example.com';
```

或使用 Prisma Studio 修改。

3. 使用该 admin 账号登录后，即可在侧边栏看到「权限管理」页面。
4. 之后所有角色调整都推荐在「权限管理」页面完成。  
   详细说明见：`CRM_权限说明.md`。

> 系统中所有与 CRM 相关的数据查询，都会根据当前用户的 `role` 与 `id` 做过滤，保证：
> - admin 可以看到所有线索 / 商机 / 客户 / 跟进记录
> - sales 只会看到自己负责的数据（详见权限文档）

---

## 五、部署与环境（概览）

### 1. 必需环境变量

部署到 Vercel / 自建服务器时，需要在平台环境变量中设置：

- **数据库**
  - `DATABASE_URL`
- **认证（NextAuth）**
  - `AUTH_SECRET`
  - `AUTH_TRUST_HOST`（通常设为 `1`）
- **邮件（可选）**
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`

### 2. 数据库迁移

正式环境建议使用迁移而不是 `db push`：

```bash
pnpm db:migrate
```

每次 schema 更新后都应执行一次迁移，并保证迁移文件提交到版本库。

### 3. 启动命令

生产环境常用命令：

```bash
pnpm build
pnpm start
```

Vercel 等平台会自动执行 `build` 和 `start`，只需确保：

- Node 版本符合 Next.js 要求
- 所有必需环境变量已配置
- 数据库已创建并可访问

---

## 六、与 CRM 业务文档的关系

- 若你是 **业务负责人 / 销售负责人**，优先阅读：
  - `CRM_四张表与表单逻辑说明.md`
  - `CRM_权限说明.md`
  - `CRM_飞书多维表格配置指南.md`
- 若你是 **开发同学**，建议阅读顺序：
  1. 本文（项目总体 + 开发部署）
  2. `PRISMA_GUIDE.md`
  3. `CRM_表结构与关系说明.md`
  4. `CRM_API_接口说明.md`
  5. `DATABASE_URL_客户端组件导入问题排查.md`
  6. `EMAIL_邮件通知与配置说明.md`

通过以上几篇文档，可以快速理解「项目能做什么」以及「代码大致怎么组织的」，方便继续扩展新模块或接其他系统。

