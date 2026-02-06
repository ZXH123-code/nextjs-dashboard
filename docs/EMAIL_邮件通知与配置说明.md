## 一、功能概览

项目中与邮件相关的功能目前集中在一个场景：

- **线索批量指定销售人员时，可选择发送邮件通知给受影响的销售人员**

涉及的主要代码：

- `app/lib/email.ts`：封装 Resend 邮件发送逻辑
- `app/lib/crm-actions.ts`：批量指定和邮件发送 Action
- `app/dashboard/crm/leads/LeadsBulkAssignBar.tsx`：批量指定操作栏
- `app/dashboard/crm/leads/EmailNotificationDialog.tsx`：邮件通知对话框

---

## 二、环境变量配置

邮件发送基于 [Resend](https://resend.com) 服务，需要在 `.env` 中配置：

```env
RESEND_API_KEY="re_xxx"         # 在 Resend 控制台创建的 API Key
RESEND_FROM_EMAIL="xxx@your.com"  # 发件人邮箱（必须是已验证域名）
```

说明：

- 若 **未配置 `RESEND_API_KEY`**，`email.ts` 中会返回 `null` 客户端，发送函数会直接返回 `{ success: false, error: "RESEND_API_KEY 未配置" }`，不会抛异常。
- `RESEND_FROM_EMAIL`：
  - 测试环境可以使用 `onboarding@resend.dev`
  - **生产环境必须使用已在 Resend 中验证过域名的邮箱**（如 `noreply@your-domain.com`）

---

## 三、邮件发送流程（用户视角）

### 线索批量指定流程

1. **Admin 在线索管理页面勾选若干条线索**
2. **在批量操作栏中选择目标销售人员，填写跟进说明**
3. **点击「批量指定」按钮**
   - 系统立即完成线索指定
   - 为每条线索创建跟进记录
4. **自动弹出「发送邮件通知」对话框**
   - 显示所有受影响的销售人员：
     - 🟢 **新接手**：新被指定的销售（接收所有被分配的线索）
     - 🟠 **被转走**：原负责人（接收被转走的线索列表）
   - 每个人显示对应的线索数量和名称
   - 默认全选所有人
5. **Admin 可以取消勾选某些人，或直接全选**
6. **点击「发送」按钮**
   - 系统并发给选中的销售人员发邮件
   - 显示发送结果（成功/失败）

### 邮件内容示例

**给新接手销售的邮件：**
```
标题：您被指定了 3 条新线索
正文：
张三，您好：
管理员已将以下线索指定给您跟进：
• 阿里巴巴
• 腾讯科技
• 字节跳动
请登录 CRM 系统查看并跟进。
```

**给被转走销售的邮件：**
```
标题：您被指定了 2 条新线索
正文：
李四，您好：
管理员已将以下线索指定给您跟进：
• 京东集团
• 美团科技
请登录 CRM 系统查看并跟进。
```

**注意：** 虽然是"被转走"，但邮件内容相同，只是后台逻辑区分了新旧销售。未来可根据需要定制不同的邮件模板。

---

## 四、技术实现细节

### 1. Server Action：`batchUpdateLeadSalesPersonWithFollowUpAction`

位置：`app/lib/crm-actions.ts`

流程：

1. **权限检查**：仅 admin 可调用
2. **查询原线索信息**：获取所有线索的原销售人员 ID
3. **批量更新销售人员**
4. **创建跟进记录**：为每条线索创建系统生成的跟进记录
5. **收集受影响的销售人员**：
   - 新指定的销售（接收所有线索）
   - 被替换的旧销售（只看到被转走的线索）
6. **返回销售人员映射表**：包含每个人的姓名、邮箱、线索列表

返回格式：
```ts
{
  salesPersonMap: {
    "user_id_1": {
      name: "张三",
      email: "zhangsan@example.com",
      leadIds: ["lead1", "lead2"],
      leadNames: ["客户A", "客户B"]
    },
    "user_id_2": { ... }
  }
}
```

### 2. Server Action：`sendBatchLeadAssignmentNotificationsAction`

位置：`app/lib/crm-actions.ts`

流程：

1. **权限检查**：仅 admin 可调用
2. **并发发送邮件**：`Promise.all` 给每个选中的销售发邮件
3. **返回发送结果**：
   - `success`: 成功的用户 ID 数组
   - `failed`: 失败的用户信息（ID、姓名、错误原因）

### 3. 封装函数：`sendLeadAssignmentNotification`

位置：`app/lib/email.ts`

行为要点：

- 若 `RESEND_API_KEY` 未配置，直接返回 `{ success: false, error: "RESEND_API_KEY 未配置" }`
- 若收件人邮箱为空，返回 `{ success: false, error: "收件人邮箱为空" }`
- 邮件标题：
  - 单条线索：`您被指定了 1 条新线索：{客户名称}`
  - 多条线索：`您被指定了 {N} 条新线索`
- 邮件内容为简单 HTML，包含销售人员姓名、线索列表、引导语
- 邮件发送失败时返回错误信息，不会影响主流程

### 4. 前端对话框：`EmailNotificationDialog`

位置：`app/dashboard/crm/leads/EmailNotificationDialog.tsx`

功能：

- 展示所有受影响的销售人员及其线索
- 区分"新接手"和"被转走"（图标和标签）
- 支持全选/单选
- 并发发送邮件并显示结果
- 成功/失败分组展示

---

## 五、常见问题与排查

1. **收不到邮件**
   - 检查 `.env` 中是否配置了正确的 `RESEND_API_KEY`
   - **检查 `RESEND_FROM_EMAIL` 是否使用了已在 Resend 验证过的域名**
   - 检查目标销售人员的邮箱是否有效（users 表的 email 字段）
   - 检查垃圾邮件/推广邮件文件夹
   - 查看 Resend 控制台 **Logs** 是否有发送记录和错误

2. **本地开发时不希望真的发邮件**
   - 可以不配置 `RESEND_API_KEY`，此时函数会短路返回
   - 或在对话框中取消勾选所有人，不发送

3. **生产环境域名配置**
   - 必须先在 Resend 添加域名并完成 DNS 验证（SPF、DKIM、DMARC）
   - `RESEND_FROM_EMAIL` 必须使用该域名（如 `noreply@yourdomain.com`）
   - 不能用 `onboarding@resend.dev`，会限制发送量

4. **某些销售收不到邮件，其他人能收到**
   - 检查该销售的 users.email 是否为空或无效
   - 查看邮件发送结果对话框中的失败原因

5. **对话框没有弹出**
   - 检查是否是 admin 角色
   - 检查 Action 是否返回了 `salesPersonMap`
   - 检查浏览器控制台是否有报错

---

## 六、扩展思路

后续如果需要更多邮件场景，例如：

- 商机状态变为「已赢单」时通知相关同事
- 客户长时间未跟进时自动提醒
- 每日/每周发送跟进任务汇总

建议复用 `email.ts` 中的封装模式：

1. 在 `email.ts` 中新增专门的发送函数（如 `sendWeeklySummaryEmail`）
2. 在对应的 Server Action 或定时任务逻辑中调用
3. 在本文件中补充新的邮件场景和环境变量说明

这样可以保持所有「邮件相关约定」都在同一份文档中清晰可查。

---

## 七、更新日志

### 2026-02-06：邮件通知流程重构

**变更内容：**

- ✅ 分离"指定销售人员"和"发送邮件"两个步骤
- ✅ 指定完成后弹出邮件通知对话框
- ✅ 支持多选销售人员发送邮件（默认全选）
- ✅ 区分"新接手"和"被转走"的销售人员
- ✅ 显示每个销售对应的线索列表
- ✅ 并发发送邮件并展示结果
- ✅ 配置生产环境域名 `silea.site` 的发件人邮箱

**技术实现：**

- 新增 `EmailNotificationDialog.tsx` 组件
- 重构 `batchUpdateLeadSalesPersonWithFollowUpAction` 返回 `salesPersonMap`
- 新增 `sendBatchLeadAssignmentNotificationsAction` 批量发送邮件
- 移除 `LeadsBulkAssignBar` 中的"发送邮件"复选框

**配置要求：**

- `.env` 中 `RESEND_FROM_EMAIL=noreply@silea.site`
- 域名 `silea.site` 已在 Resend 完成 DNS 验证

