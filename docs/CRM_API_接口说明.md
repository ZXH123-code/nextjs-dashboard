## 一、概览

当前 CRM 相关的「对外接口」主要集中在：

- `app/api/crm/leads/import/route.ts`  
  - 路径：`POST /api/crm/leads/import`
  - 用途：上传 Excel（`.xlsx`）批量导入线索
  - 权限：仅 `admin` 用户可调用

其他大部分 CRM 操作（新建/编辑/状态变更等）是通过 **Next.js Server Actions** 实现的，不暴露为传统 REST API，而是由表单直接调用 `app/lib/crm-actions.ts` 中的函数。

---

## 二、`POST /api/crm/leads/import` —— 线索批量导入

### 1. 权限控制

- 使用 `auth()` 获取当前登录用户信息
- 从 session / 数据库获取 `role`，仅当 `role === "admin"` 时允许导入
- 非 admin 会返回：

```json
HTTP 403
{
  "error": "无权限"
}
```

### 2. 请求格式（multipart/form-data）

该接口要求使用 `multipart/form-data`，前端通常通过 `FormData` 构造：

- **字段说明**

| 字段名 | 类型 | 是否必填 | 说明 |
| ------ | ---- | -------- | ---- |
| `file` | File | 是 | Excel 文件（仅支持 `.xlsx`） |
| `mode` | string | 否 | `preview` / `import`，默认 `preview` |

前端典型调用方式（伪代码）：

```ts
const formData = new FormData();
formData.append("file", file);             // 选中的 .xlsx 文件
formData.append("mode", "preview");       // 或 "import"

await fetch("/api/crm/leads/import", {
  method: "POST",
  body: formData,
});
```

> **推荐流程**：先用 `mode=preview` 获取预览与错误信息，确认无误后再用 `mode=import` 真正写入数据库。

### 3. 文件与内容校验

1. **文件存在性**
   - 若缺失 `file` 或类型不是 `File`：
   - 返回 `400`，`{ error: "请上传 Excel 文件" }`

2. **文件格式**
   - 仅允许 `.xlsx` 扩展名：
   - 否则返回 `400`，`{ error: "目前仅支持 .xlsx 格式" }`

3. **文件大小**
   - 默认最大 5MB：
   - 超过时返回 `400`，`{ error: "文件过大，请控制在 5MB 以内" }`

4. **表格内容**
   - 使用 `XLSX.read` 读取工作簿，只处理**第一张工作表**
   - 第一行视为表头，从第二行开始为数据
   - 若行数为 0（无数据行），返回 `400`，`{ error: "表格内容为空" }`

### 4. 支持的表头与字段映射

接口期望的中文表头与 `crm_leads` 字段对应关系：

| Excel 列名 | 是否必填 | 映射到数据库字段 | 说明 |
| ---------- | -------- | ---------------- | ---- |
| 客户名称 | 是 | `customerName` | 为空则整行报错并跳过 |
| 昵称 | 否 | `nickname` |  |
| 城市 | 否 | `city` |  |
| 详细地址 | 否 | `address` |  |
| 行业 | 否 | `industry` |  |
| 线索来源 | 否 | `leadSource` | 如「展会」「官网」「转介绍」等 |
| 客户分层 | 否 | `customerTier` | 如 A/B/C 等 |
| 销售人员邮箱 | 否 | `salesPersonId`（通过邮箱匹配 `users`） |  |
| 状态 | 否 | `status` | 允许：`未跟进` / `跟进中` / `有意向` / `无意向` |

> 详细业务说明和 Excel 模板示例见：`CRM_线索批量导入说明.md`。

### 5. 行级校验逻辑（简述）

对每一行（从第 2 行开始）：

1. **客户名称为空**
   - 记录错误「客户名称为空」
   - 该行标记为 `error`，不会写入
2. **状态字段**
   - 允许值：`未跟进` / `跟进中` / `有意向` / `无意向`
   - 为空时自动填充为 `未跟进`
   - 值不合法时记录错误「状态不合法：xxx，仅支持 未跟进/跟进中/有意向/无意向」
3. **销售人员邮箱**
   - 预先收集所有非空邮箱，`where email in (...)` 一次查出所有 `users`
   - 单行中的邮箱在 `users.email` 中找不到时，记录错误  
     「销售人员邮箱在系统中不存在：xxx」，该行不会写入

其它字段若为空则写入 `null/undefined`，有值则直接写入。

### 6. 预览与正式导入的行为差异

#### `mode=preview`（默认）

- **不写入数据库**
- 会返回：

```json
{
  "mode": "preview",
  "success": true,
  "willInsert": 10,          // 若正式导入，将写入多少条
  "failed": 2,               // 共有多少错误行
  "errors": [ ... ],         // 每一条错误的 { row, message }
  "preview": [ ... ]         // 前 50 行的预览数据（含 status 和 message）
}
```

前端可根据此结果高亮显示哪些行有问题，提示用户修正。

#### `mode=import`

- 对通过校验的行调用：

```ts
await prisma.crm_lead.createMany({ data: dataToInsert });
```

- 返回结构：

```json
{
  "mode": "import",
  "success": true,
  "inserted": 10,   // 实际写入条数
  "failed": 2,      // 错误行数
  "errors": [ ... ],
  "preview": [ ... ]  // 仍然会返回前 50 行的预览
}
```

若所有行都失败（`dataToInsert.length === 0`），则直接返回 `400`：

```json
{
  "mode": "import",
  "error": "没有可导入的数据，请检查表格格式和内容",
  "errors": [ ... ],
  "preview": [ ... ],
  "willInsert": 0
}
```

### 7. 异常处理

若在解析或写入过程中抛出未捕获错误（如 Excel 格式异常），接口会返回：

```json
HTTP 500
{
  "error": "解析或导入 Excel 失败，请检查文件格式"
}
```

---

## 三、与前端页面的协作关系

- 导入页面：`/dashboard/crm/leads/import`
  - 使用客户端组件 `LeadImportClient.tsx`
  - 前端负责：
    - 文件选择与校验（基本）
    - 调用 `/api/crm/leads/import`
    - 根据返回的 `preview` 与 `errors` 渲染预览结果与错误提示
  - 内置两步流程：
    1. 上传文件 → `mode=preview` 显示预览
    2. 用户确认无误后 → `mode=import` 真正导入

当你需要调整导入字段、校验规则或权限时，主要改动点为：

- 后端：`app/api/crm/leads/import/route.ts`
- 文档：`docs/CRM_线索批量导入说明.md` 与本文档

---

## 四、后续扩展建议

如果未来增加更多对外 API（例如导出报表、第三方系统同步等），建议：

1. 均放在 `app/api/crm/...` 下，按资源模块拆分
2. 在本文件中增加对应小节，统一记录：
   - 路径 + 方法
   - 权限要求
   - 请求格式与字段
   - 响应结构
   - 与前端页面/任务的对应关系

这样能保证「看一份文档就知道所有对外接口长什么样、给谁用」。

