/**
 * 邮件发送工具（使用 Resend）
 * 收件人为销售人员的注册/登录邮箱（users.email）
 */

import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export type LeadInfo = { id: string; customerName: string };

/**
 * 发送线索指定通知邮件给销售人员（支持同时显示新接手和被转走的线索）
 * @param toEmail 销售人员的注册邮箱（users.email）
 * @param salesPersonName 销售人员姓名
 * @param assignedLeads 新接手的线索列表
 * @param unassignedLeads 被转走的线索列表（可选）
 */
export async function sendLeadAssignmentNotification(
  toEmail: string,
  salesPersonName: string,
  assignedLeads: LeadInfo[],
  unassignedLeads?: LeadInfo[]
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    return { success: false, error: "RESEND_API_KEY 未配置" };
  }
  if (!toEmail?.trim()) {
    return { success: false, error: "收件人邮箱为空" };
  }

  const totalCount = assignedLeads.length + (unassignedLeads?.length || 0);
  if (totalCount === 0) {
    return { success: false, error: "没有线索需要通知" };
  }

  // 构建邮件主题
  let subject = "";
  if (assignedLeads.length > 0 && (!unassignedLeads || unassignedLeads.length === 0)) {
    subject =
      assignedLeads.length === 1
        ? `您被指定了 1 条新线索：${assignedLeads[0].customerName}`
        : `您被指定了 ${assignedLeads.length} 条新线索`;
  } else if ((!assignedLeads || assignedLeads.length === 0) && unassignedLeads && unassignedLeads.length > 0) {
    subject = `您有 ${unassignedLeads.length} 条线索被转走`;
  } else {
    subject = `线索分配变更通知（新增 ${assignedLeads.length} 条，转走 ${unassignedLeads?.length || 0} 条）`;
  }

  // 构建邮件内容
  let contentHtml = "";

  if (assignedLeads.length > 0) {
    const assignedListHtml = assignedLeads
      .map((l) => `<li style="margin: 4px 0;">${escapeHtml(l.customerName)}</li>`)
      .join("");
    contentHtml += `
  <div style="margin-bottom: 20px;">
    <h3 style="color: #16a34a; margin-bottom: 8px;">✓ 新接手的线索（${assignedLeads.length} 条）</h3>
    <ul style="margin: 0; padding-left: 20px;">${assignedListHtml}</ul>
  </div>`;
  }

  if (unassignedLeads && unassignedLeads.length > 0) {
    const unassignedListHtml = unassignedLeads
      .map((l) => `<li style="margin: 4px 0;">${escapeHtml(l.customerName)}</li>`)
      .join("");
    contentHtml += `
  <div style="margin-bottom: 20px;">
    <h3 style="color: #ea580c; margin-bottom: 8px;">→ 被转走的线索（${unassignedLeads.length} 条）</h3>
    <ul style="margin: 0; padding-left: 20px;">${unassignedListHtml}</ul>
  </div>`;
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.6; color: #333;">
  <p>${escapeHtml(salesPersonName)}，您好：</p>
  <p>您的线索分配有以下变更：</p>
  ${contentHtml}
  <p style="color: #666; font-size: 14px;">请登录 CRM 系统查看详情并跟进。</p>
</body>
</html>`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [toEmail.trim()],
    subject,
    html,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
