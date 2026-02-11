# AI 问数：功能说明

自然语言提问 → AI 生成 SQL → 只读执行 → 返回文字回答与可选表格。入口在顶部栏紫色「AI 智能助手」按钮，点击后右侧滑出问数面板。

## 功能概览

- **入口**：顶部栏紫色 Sparkles 按钮（AI 智能助手），打开右侧 Sheet 面板。
- **能力**：输入自然语言问题（如「本月各销售的线索数」「所有销售人员的优劣势」），AI 生成 1～5 条 SELECT，执行后综合结果给出文字回答；若有结构化结果则同时展示表格。
- **数据范围**：仅 CRM 相关表（users、crm_leads、crm_opportunities、crm_customers、crm_follow_ups），与当前用户权限一致（admin 看全部，sales 仅看自己负责数据）。

## 实现位置

| 说明     | 路径 |
|----------|------|
| Server Action、SQL 生成/校验/执行、总结 | `app/lib/ai-query.ts` |
| 问数面板 UI（Sheet、输入、结果、表格） | `app/ui/dashboard/ai-query-sheet.tsx` |
| 顶部栏入口（打开 Sheet） | `app/ui/dashboard/topbar.tsx` |

## 安全与约束

- **仅 SELECT**：生成的 SQL 经整词关键字校验（INSERT/UPDATE/DELETE 等），列名如 `deleted_at` 不会误伤。
- **只读数据库**：可配置 `DATABASE_URL_READONLY`，问数使用只读连接执行，写操作会被数据库拒绝。详见 [AI_问数_只读数据库用户.md](./AI_问数_只读数据库用户.md)。
- **权限**：复用 `getCrmAuth()`，sales 在 prompt 中要求对相关表加 `sales_person_id` 条件。
- **结果序列化**：返回前对 BigInt/Date/Symbol/Decimal/循环引用做 `sanitizeForJson`，避免 Server Action 或 JSON 序列化报错。

## 控制台日志（开发环境）

在 **服务端** 运行 `pnpm dev` 时，每次问数**即将执行**的 SQL 会打印到该终端：

```
[AI 问数] 即将执行 SQL：
  [1] SELECT COUNT(*) AS lead_count FROM crm_leads WHERE ...
```

仅 `NODE_ENV === "development"` 时输出，生产环境不打印。**前端不展示 SQL**，需要查看实际执行的 SQL 时请查看服务端控制台。

## 相关文档

- [AI_问数_配置说明.md](./AI_问数_配置说明.md) — 三种接入方式（Gateway / DeepSeek 直连 / OpenAI 直连）、环境变量、DeepSeek 全球可用性。
- [AI_问数_只读数据库用户.md](./AI_问数_只读数据库用户.md) — 只读 DB 用户创建与 `DATABASE_URL_READONLY` 配置。
