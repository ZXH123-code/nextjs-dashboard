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
 * 发送线索指定通知邮件给销售人员
 * @param toEmail 销售人员的注册邮箱（users.email）
 * @param salesPersonName 销售人员姓名
 * @param leads 被指定的线索列表
 */
export async function sendLeadAssignmentNotification(
  toEmail: string,
  salesPersonName: string,
  leads: LeadInfo[]
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    return { success: false, error: "RESEND_API_KEY 未配置" };
  }
  if (!toEmail?.trim()) {
    return { success: false, error: "收件人邮箱为空" };
  }

  const leadListHtml = leads
    .map((l) => `<li>${escapeHtml(l.customerName)}</li>`)
    .join("");
  const subject =
    leads.length === 1
      ? `您被指定了 1 条新线索：${leads[0].customerName}`
      : `您被指定了 ${leads.length} 条新线索`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.6; color: #333;">
  <p>${escapeHtml(salesPersonName)}，您好：</p>
  <p>管理员已将以下线索指定给您跟进：</p>
  <ul>${leadListHtml}</ul>
  <p>请登录 CRM 系统查看并跟进。</p>
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
