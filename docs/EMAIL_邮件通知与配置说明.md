## 一、功能概览

项目中与邮件相关的功能目前集中在一个场景：

- **线索批量指定销售人员时，可选发送邮件通知给该销售**

涉及的主要代码：

- `app/lib/email.ts`：封装 Resend 邮件发送逻辑
- `app/lib/crm-actions.ts`：在 `batchUpdateLeadSalesPersonAction` 中调用邮件发送

---

## 二、环境变量配置

邮件发送基于 [Resend](https://resend.com) 服务，需要在 `.env` 中配置：

```env
RESEND_API_KEY="re_xxx"         # 在 Resend 控制台创建的 API Key
RESEND_FROM_EMAIL="xxx@your.com"  # 发件人邮箱
```

说明：

- 若 **未配置 `RESEND_API_KEY`**，`email.ts` 中会返回 `null` 客户端，发送函数会直接返回 `{ success: false, error: "RESEND_API_KEY 未配置" }`，不会抛异常。
- `RESEND_FROM_EMAIL`：
  - 测试环境可以使用 `onboarding@resend.dev`
  - 生产环境应使用已在 Resend 中验证过域名的邮箱（如 `noreply@your-domain.com`）

---

## 三、邮件发送逻辑（技术视角）

### 1. 封装函数：`sendLeadAssignmentNotification`

位置：`app/lib/email.ts`

签名：

```ts
export type LeadInfo = { id: string; customerName: string };

export async function sendLeadAssignmentNotification(
  toEmail: string,
  salesPersonName: string,
  leads: LeadInfo[]
): Promise<{ success: boolean; error?: string }>
```

行为要点：

- 若 `RESEND_API_KEY` 未配置，直接返回 `{ success: false, error: "RESEND_API_KEY 未配置" }`
- 若收件人邮箱为空（或全是空格），返回 `{ success: false, error: "收件人邮箱为空" }`
- 邮件标题：
  - 单条线索：`您被指定了 1 条新线索：{客户名称}`
  - 多条线索：`您被指定了 {N} 条新线索`
- 邮件内容为简单 HTML，包含：
  - 称呼（销售人员姓名）
  - 被指定的线索列表（客户名称列表）
  - 引导语「请登录 CRM 系统查看并跟进」
- 邮件发送失败（如 Resend 报错）：
  - 返回 `{ success: false, error: error.message }`
  - 调用方可根据需要记录日志，但**不会影响主流程**

### 2. 调用入口：批量指定线索的销售人员

位置：`app/lib/crm-actions.ts` → `batchUpdateLeadSalesPersonAction`

伪代码流程：

```ts
export async function batchUpdateLeadSalesPersonAction(
  leadIds: string[],
  salesPersonId: string,
  sendEmail: boolean
) {
  // 仅 admin 可调用
  // 1. 批量更新数据库中的 salesPersonId
  await updateLeadSalesPersonBatch(leadIds, salesPersonId);

  // 2. 如果勾选了「发送邮件」，才继续以下逻辑
  if (sendEmail) {
    // 2.1 根据 salesPersonId 查找销售人员邮箱与姓名
    const salesPerson = await prisma.users.findUnique({ ... });

    // 2.2 查找被指定的线索列表（id + 客户名称）
    const leads = await prisma.crm_lead.findMany({ ... });

    // 2.3 调用 sendLeadAssignmentNotification
    const result = await sendLeadAssignmentNotification(
      salesPerson.email,
      salesPerson.name,
      leads.map(l => ({ id: l.id, customerName: l.customerName }))
    );

    // 2.4 若发送失败，只在服务端 console 打一条错误日志，不影响线索分配本身
  }
}
```

关键点：

- **分配成功优先**：即使邮件发送失败，也不会回滚线索分配。
- **只在 admin 批量分配时触发**：单条线索编辑不发送邮件。

---

## 四、前端交互（简要）

在「线索管理表」页面进行批量操作时（多选若干条线索后），前端会提供：

- 选择目标销售人员
- 勾选「是否发送邮件通知」

提交后会调用 `batchUpdateLeadSalesPersonAction`，并显示操作结果；邮件是否发送成功不会直接展示给最终用户，仅在服务端日志中记录失败原因。

---

## 五、常见问题与排查

1. **收不到邮件**
   - 检查 `.env` 中是否配置了正确的 `RESEND_API_KEY`
   - 检查 `RESEND_FROM_EMAIL` 是否使用了已验证过的域名
   - 检查目标邮箱是否落入垃圾邮件/推广邮件
   - 查看服务器日志是否有 `线索指定邮件发送失败: ...` 的输出

2. **本地开发时不希望真的发邮件**
   - 可以不配置 `RESEND_API_KEY`，此时函数会短路返回，不会真正调用 Resend
   - 或在开发环境将 `RESEND_FROM_EMAIL` 设置为自己的测试邮箱，并限制实际调用次数

3. **生产环境切换邮件服务商**
   - 当前封装只依赖 Resend 的 `resend.emails.send` 调用
   - 若未来改用其他服务（如 SES、SendGrid），可在 `email.ts` 中统一替换实现，不影响调用方

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

