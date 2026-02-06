# CRM 线索变更邮件通知功能说明

## 一、功能概述

实现独立的"邮件通知"功能，追踪线索销售人员变更并按需发送邮件通知。

### 核心特性
- ✅ **自动追踪**：每次销售人员变更时自动记录（批量指定/单个修改）
- ✅ **独立入口**：线索管理页顶部"邮件通知（N人）"按钮
- ✅ **权限分离**：Admin 看所有待通知人员，Sales 只看自己的
- ✅ **多选发送**：可选择通知哪些人，默认全选
- ✅ **一人一封**：每封邮件包含"新接手的线索" + "被转走的线索"
- ✅ **已读标记**：发送后标记为已通知，不会重复发送

---

## 二、数据库表结构

### 新增表：`crm_lead_assignment_notifications`

```sql
CREATE TABLE crm_lead_assignment_notifications (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES crm_leads(id),
  change_type VARCHAR(20) NOT NULL, -- 'assigned' | 'reassigned' | 'unassigned'
  
  old_sales_person_id UUID REFERENCES users(id),
  new_sales_person_id UUID REFERENCES users(id),
  
  notified BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id)
);
```

**索引：**
- `lead_id`
- `old_sales_person_id`
- `new_sales_person_id`
- `notified`
- `created_at`

---

## 三、使用流程

### 用户视角（Admin）

1. **线索管理页** → 顶部有"邮件通知（待通知 N 人）"按钮
2. 点击按钮 → 弹出对话框
3. 对话框显示所有待通知的销售人员：
   - 姓名、邮箱
   - 🟢 新接手 X 条
   - 🟠 被转走 Y 条
4. 默认全选，可取消勾选某些人
5. 点击"发送给选中的 N 人"
6. 显示发送结果（成功/失败）
7. 关闭对话框，页面刷新，待通知数量更新

### 用户视角（Sales）

1. **线索管理页** → 顶部"邮件通知"按钮（只看到自己的待通知）
2. 点击后只能看到自己的变更
3. 可以发送通知给自己

### 邮件内容示例

**标题：** 线索分配变更通知（新增 2 条，转走 1 条）

**正文：**
```
张三，您好：

您的线索分配有以下变更：

✓ 新接手的线索（2 条）
• 阿里巴巴
• 腾讯科技

→ 被转走的线索（1 条）
• 京东集团

请登录 CRM 系统查看详情并跟进。
```

---

## 四、技术实现

### 1. 数据层（`crm.ts`）

**新增函数：**

```typescript
// 记录单个变更
recordLeadAssignmentChange(data: {
  leadId: string;
  oldSalesPersonId: string | null;
  newSalesPersonId: string | null;
  createdBy: string;
})

// 批量记录变更
recordLeadAssignmentChanges(
  leadChanges: Array<{...}>,
  createdBy: string
)

// 获取待通知（权限过滤）
getPendingNotifications(auth: CrmAuth)

// 标记为已发送
markNotificationsAsSent(notificationIds: string[])
```

### 2. Server Actions（`crm-actions.ts`）

**修改现有函数：**
- `updateLeadSalesPersonWithFollowUpAction` - 自动记录变更
- `batchUpdateLeadSalesPersonWithFollowUpAction` - 自动记录变更

**新增函数：**

```typescript
// 获取待通知人员列表（按人员分组）
getPendingNotificationSummaryAction(): Promise<{
  salesPersons: Array<{
    id: string;
    name: string;
    email: string;
    assignedCount: number;
    unassignedCount: number;
  }>;
}>

// 发送邮件并标记为已通知
sendPendingNotificationsAction(
  salesPersonIds: string[]
): Promise<{
  success: string[];
  failed: Array<{ id: string; name: string; error: string }>;
}>
```

### 3. 邮件模板（`email.ts`）

**更新函数签名：**

```typescript
sendLeadAssignmentNotification(
  toEmail: string,
  salesPersonName: string,
  assignedLeads: LeadInfo[],
  unassignedLeads?: LeadInfo[] // 可选
)
```

**邮件内容：**
- 标题根据变更类型动态生成
- 内容分两部分：新接手（绿色）+ 被转走（橙色）
- HTML 格式，带样式

### 4. 前端组件

**新增组件：**

`PendingNotificationDialog.tsx`
- 弹出对话框
- 展示待通知人员列表
- 多选发送
- 显示发送结果

**修改组件：**

`LeadsPageActions.tsx`
- 添加"邮件通知（N人）"按钮
- useEffect 加载待通知数量
- 集成 PendingNotificationDialog

---

## 五、权限控制

### Admin
- 可以看到所有待通知的销售人员
- 可以选择通知任何人

### Sales
- 只能看到自己的待通知变更（新接手的 + 被转走的）
- 只能发送给自己

**实现方式：**
```typescript
const where =
  auth.role === "admin"
    ? { notified: false }
    : {
        notified: false,
        OR: [
          { oldSalesPersonId: auth.userId },
          { newSalesPersonId: auth.userId },
        ],
      };
```

---

## 六、常见问题

### 1. 为什么收不到邮件？

**检查清单：**
- ✅ `.env` 中 `RESEND_API_KEY` 已配置
- ✅ `RESEND_FROM_EMAIL` 使用已验证域名（`noreply@silea.site`）
- ✅ 销售人员的 `users.email` 字段不为空
- ✅ 查看 Resend 控制台 Logs

### 2. 待通知数量不更新？

- 发送邮件后关闭对话框会自动刷新
- 或手动刷新页面

### 3. Sales 看不到自己的待通知？

- 确认该 Sales 确实有待通知的变更
- 检查数据库 `crm_lead_assignment_notifications` 表中该 Sales 的记录
- 确认 `notified` 字段为 `false`

### 4. 重复发送邮件？

- 不会。发送成功后会标记 `notified = true`，不会再次出现在待通知列表

### 5. 如何测试？

**本地测试：**
1. 修改一条线索的销售人员（单个修改）
2. 或批量指定线索给某个销售
3. 点击"邮件通知"按钮查看待通知列表
4. 选择通知对象并发送
5. 检查邮箱或 Resend 控制台

---

## 七、数据库迁移

使用 Prisma 推送 schema 变更：

```bash
pnpm prisma db push
```

**注意：**
- 会创建 `crm_lead_assignment_notifications` 表
- 会添加外键约束
- 不会影响现有数据

---

## 八、与批量指定邮件的区别

### 原有批量指定邮件（保留）
- 时机：批量指定完成后立即弹出
- 目的：立即通知新接手的销售
- 特点：一次性，不追踪历史

### 新增独立邮件通知（本次实现）
- 时机：任何时候，由 Admin/Sales 主动触发
- 目的：追踪所有未通知的变更，统一发送
- 特点：持久化追踪，可随时发送，支持查看自己的待通知

**两者可以共存：**
- 批量指定后可以选择"立即通知"（原有功能）
- 也可以稍后在"邮件通知"按钮里统一发送（新功能）

---

## 九、未来扩展

### 可能的优化方向

1. **定时自动发送**
   - 每天固定时间自动发送所有待通知邮件
   - 或每次变更后 N 小时自动发送

2. **邮件模板定制**
   - 支持自定义邮件标题和内容
   - 支持添加公司 Logo

3. **通知历史**
   - 查看已发送的邮件历史
   - 支持重新发送

4. **批量操作**
   - 一键"全部通知"
   - 一键"清空待通知"

5. **推送通知**
   - 除邮件外，支持站内消息、微信通知等

---

## 十、更新日志

### 2026-02-06：初始实现

**新增：**
- ✅ `crm_lead_assignment_notifications` 表
- ✅ 自动记录销售人员变更
- ✅ 独立邮件通知入口
- ✅ 待通知人员列表对话框
- ✅ 权限分离（Admin/Sales）
- ✅ 一人一封邮件（新接手 + 被转走）
- ✅ 已读标记机制

**配置：**
- 域名：`silea.site`
- 发件人：`noreply@silea.site`
- Resend DNS 已验证
