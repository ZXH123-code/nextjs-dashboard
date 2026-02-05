## 项目简介

这是一个基于 **Next.js App Router** 的 CRM 仪表盘项目，主要面向中小团队的销售管理场景，核心能力包括：

- **CRM 四张表**：线索、商机、客户、跟进记录，支持从线索 → 商机 → 客户的完整流转
- **角色与权限**：区分销售总管 (`admin`) 和销售人员 (`sales`)，自动做数据行级过滤
- **线索批量导入**：支持上传 Excel（`.xlsx`） 批量导入线索，并提供预览模式
- **邮件通知**：线索批量指定销售人员时，可选发送邮件通知销售
- **多端协同**：内置与飞书多维表格匹配的字段与逻辑（文档在 `docs` 目录中）

详细业务与技术文档见 `docs/` 目录：

- CRM 业务逻辑与表结构
- 权限说明
- 批量导入说明
- 飞书多维表格配置
- Prisma 与数据库使用说明

---

## 技术栈

- **框架**：Next.js（App Router）
- **语言**：TypeScript / React
- **样式**：Tailwind CSS、Radix UI
- **数据库**：PostgreSQL + Prisma ORM
- **认证**：NextAuth.js 5（Credentials Provider）
- **工具库**：Zod、XLSX、Resend（邮件）

---

## 快速开始（本地开发）

### 1. 克隆与安装依赖

```bash
pnpm install
```

项目使用 `pnpm`，如未安装请先：

```bash
npm install -g pnpm
```

### 2. 配置环境变量

在项目根目录创建或编辑 `.env`，至少需要：

```env
# PostgreSQL 数据库连接
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# NextAuth / Auth
AUTH_SECRET="生成一个随机字符串"
AUTH_TRUST_HOST=1

# 可选：Resend 邮件（线索分配邮件通知）
RESEND_API_KEY="re_xxx"
RESEND_FROM_EMAIL="onboarding@resend.dev"
```

> **注意**：仓库中的 `.env` 只适用于本地开发示例，实际项目请务必替换为自己的数据库与密钥。

### 3. 初始化数据库

首次运行前需要同步 Prisma schema 到数据库：

```bash
pnpm db:push
# 或如果你希望生成迁移文件：
pnpm db:migrate
```

如需查看/编辑数据：

```bash
pnpm db:studio
```

### 4. （可选）初始化种子数据

项目包含种子脚本（用户/示例数据等）：

```bash
pnpm db:seed
```

或直接运行：

```bash
pnpm seed
```

### 5. 启动开发服务器

```bash
pnpm dev
```

访问 `http://localhost:3000`。

---

## 主要功能模块一览

- **认证与登录**
  - 使用 NextAuth Credentials 登录
  - 用户表为 `users`，包含 `email`、`password`（加密）、`role`

- **CRM 模块**
  - 线索管理：支持看板视图、状态流转、批量指定销售人员
  - 商机管理：支持关联线索、状态流转（初步沟通 → 方案确认 → 待签约 / 已赢单 / 已丢单）
  - 客户管理：支持从商机自动生成客户，维护客户分层、标签等
  - 跟进记录：可挂在线索/商机/客户上，方便查看历史沟通

- **权限系统**
  - `admin`：可查看/管理所有 CRM 数据，并可在「权限管理」页修改其他用户角色
  - `sales`：仅能看到自己负责的线索/商机/客户/跟进记录

- **线索批量导入**
  - 页面：`/dashboard/crm/leads/import`（仅 admin 可见）
  - 支持预览模式与正式导入
  - 详细字段与校验规则见 `docs/CRM_线索批量导入说明.md`

- **邮件通知**
  - 使用 Resend 发送「线索指定通知」邮件给销售人员
  - 配置与行为见 `docs/EMAIL_邮件通知与配置说明.md`（本次补充）

---

## 文档索引（docs/ 目录）

- `CRM_四张表与表单逻辑说明.md`：面向业务与使用者，说明线索/商机/客户/跟进记录的用法
- `CRM_表结构与关系说明.md`：面向开发，介绍 CRM 相关数据库表与字段
- `CRM_线索批量导入说明.md`：Excel 导入线索的字段、校验与典型流程
- `CRM_权限说明.md`：角色 (`admin`/`sales`) 与数据过滤规则
- `CRM_飞书多维表格配置指南.md`：在飞书多维表格中还原同款 CRM 结构
- `DATABASE_URL_客户端组件导入问题排查.md`：关于 `DATABASE_URL` 报错与 `crm-constants` 拆分的说明
- `PRISMA_GUIDE.md`：Prisma 使用与常见命令
- `PROJECT_总体说明与开发部署指南.md`：项目总览、开发流程、部署要点（本次补充）
- `CRM_API_接口说明.md`：CRM 相关 API（尤其是导入接口）的使用说明（本次补充）
- `EMAIL_邮件通知与配置说明.md`：邮件服务与环境变量配置（本次补充）

---

## 部署建议（简要）

- 使用 Vercel / 自建 Node.js 服务均可，需保证：
  - `DATABASE_URL` 指向可访问的 PostgreSQL 实例
  - `AUTH_SECRET`、`RESEND_API_KEY` 等环境变量已经在平台上配置
  - 生产环境使用 `pnpm db:migrate` 管理迁移记录
- 若从零部署，请先创建至少一个用户并将其 `role` 改为 `admin`，再通过「权限管理」页面分配其他用户角色，详见 `docs/CRM_权限说明.md`。
