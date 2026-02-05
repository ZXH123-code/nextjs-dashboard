# DATABASE_URL 环境变量未设置 - 问题排查与解决

## 问题现象

控制台报错：

```
❌ DATABASE_URL 环境变量未设置！
请在项目根目录的 .env 文件中添加：
DATABASE_URL="postgresql://用户名:密码@主机:端口/数据库名?schema=public"
```

**注意**：即使 `.env` 中已正确配置 `DATABASE_URL`（无论是否用双引号包裹），仍可能出现此错误。

---

## 根本原因

**客户端组件间接导入了 `prisma`，导致在浏览器端执行时 `process.env.DATABASE_URL` 不可用。**

### 依赖链分析

1. 客户端组件（`"use client"`）如 `NewOpportunityForm`、`EditLeadForm` 需要 CRM 常量（如 `OPPORTUNITY_STATUS`、`LEAD_STATUS`）
2. 若从 `crm.ts` 导入这些常量，会触发整条依赖链：
   ```
   客户端组件 → crm.ts → prisma.ts → 校验 DATABASE_URL
   ```
3. `crm.ts` 依赖 `prisma`（用于数据库操作）
4. `prisma.ts` 在模块加载时立即执行 `validateDatabaseConfig()`，检查 `process.env.DATABASE_URL`
5. 在**浏览器端**，Next.js 不会暴露服务端环境变量，`process.env.DATABASE_URL` 为 `undefined`，因此报错

### 为何 .env 格式没问题？

`.env` 中 `DATABASE_URL=postgresql://...` 的写法是正确的，**无需双引号**。问题不在于配置格式，而在于 **prisma 模块被错误地加载到了客户端执行上下文中**。

---

## 解决方案

### 原则

**将纯常量与数据库相关逻辑分离**，确保客户端组件只导入无数据库依赖的模块。

### 具体步骤

#### 1. 新建 `app/lib/crm-constants.ts`

仅包含常量，不依赖数据库、prisma 或任何服务端环境变量：

```typescript
/**
 * CRM 常量（纯数据，无数据库依赖，可在客户端使用）
 */
export const LEAD_STATUS = ["未跟进", "跟进中", "有意向", "无意向"] as const;
export const OPPORTUNITY_STATUS = ["初步沟通", "方案确认", "待签约", "已赢单", "已丢单"] as const;
export const CUSTOMER_STATUS = ["预备签约", "已签约", "流失"] as const;
```

#### 2. 修改 `app/lib/crm.ts`

从 `crm-constants` 导入并重新导出常量，供服务端组件继续使用：

```typescript
// ============ 常量（从独立文件导入，便于客户端组件使用） ============
export { LEAD_STATUS, OPPORTUNITY_STATUS, CUSTOMER_STATUS } from "./crm-constants";
```

#### 3. 客户端组件改为从 `crm-constants` 导入

| 文件 | 修改前 | 修改后 |
|------|--------|--------|
| `NewOpportunityForm.tsx` | `import { OPPORTUNITY_STATUS } from "@/app/lib/crm"` | `import { OPPORTUNITY_STATUS } from "@/app/lib/crm-constants"` |
| `EditLeadForm.tsx` | `import { LEAD_STATUS } from "@/app/lib/crm"` | `import { LEAD_STATUS } from "@/app/lib/crm-constants"` |

#### 4. 服务端组件保持不变

`page.tsx`、`crm-actions.ts` 等服务端代码仍可从 `crm.ts` 导入常量或数据函数，因为它们在服务端执行，`process.env.DATABASE_URL` 可用。

---

## 导入规则总结

| 使用场景 | 应导入自 | 说明 |
|----------|----------|------|
| 客户端组件（`"use client"`）需要常量 | `crm-constants` | 无 prisma 依赖，可在浏览器执行 |
| 服务端组件 / Server Actions 需要常量 | `crm` 或 `crm-constants` | 均可，推荐 `crm` 保持兼容 |
| 需要数据库操作（getLeads、getUsers 等） | `crm` | 仅服务端使用 |

---

## 避免的写法

- 在客户端组件中 `import { xxx } from "@/app/lib/crm"`（若 crm 依赖 prisma）
- 在 `prisma.ts` 中使用 `@next/env` 的 `loadEnvConfig`（该包可能无法解析，且不解决根本问题）

---

## 验证

修改完成后，执行 `pnpm dev`，访问 CRM 相关页面（如线索编辑、新建商机），不应再出现 `DATABASE_URL 环境变量未设置` 的报错。
