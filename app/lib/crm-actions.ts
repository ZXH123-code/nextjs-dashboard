"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "./prisma";

async function checkCrmPermission(
  userId: string,
  role: string,
  record: { salesPersonId: string | null } | null
): Promise<boolean> {
  if (!record) return false;
  if (role === "admin") return true;
  return record.salesPersonId === userId;
}
import {
  createLead,
  createOpportunity,
  createCustomer,
  createFollowUp,
  updateCustomer,
  updateLead,
  updateLeadStatus,
  updateLeadSalesPerson,
  updateLeadSalesPersonBatch,
  deleteLead,
  updateOpportunity,
  updateOpportunityStatus,
  opportunityToCustomer,
  updateFollowUp,
  deleteFollowUp,
  recordLeadAssignmentChange,
  recordLeadAssignmentChanges,
  getPendingNotifications,
  markNotificationsAsSent,
  getCrmAuth,
} from "./crm";
import { sendLeadAssignmentNotification } from "./email";

// 创建线索（销售人员从下拉选择，未选则显示为未指定）
export async function createLeadAction(formData: FormData) {
  const customerName = formData.get("customerName") as string;
  if (!customerName?.trim()) return { error: "客户名称必填" };
  const salesPersonId = (formData.get("salesPersonId") as string) || undefined;

  await createLead({
    customerName: customerName.trim(),
    nickname: (formData.get("nickname") as string) || undefined,
    city: (formData.get("city") as string) || undefined,
    address: (formData.get("address") as string) || undefined,
    industry: (formData.get("industry") as string) || undefined,
    leadSource: (formData.get("leadSource") as string) || undefined,
    customerTier: (formData.get("customerTier") as string) || undefined,
    status: (formData.get("status") as string) || "未跟进",
    salesPersonId,
  });
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  redirect("/dashboard/crm/leads");
}

/** 新建一条空线索（仅 admin），用于表格内 Excel 风格补全 */
export async function createEmptyLeadAction(): Promise<{ error?: string }> {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (role !== "admin") return { error: "权限不足" };

  await createLead({
    customerName: "（待补全）",
    status: "未跟进",
  });
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  return {};
}

// 更新线索状态（改为「有意向」后，自动创建商机）
export async function updateLeadStatusAction(leadId: string, status: string) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return;
  const lead = await prisma.crm_lead.findUnique({ 
    where: { id: leadId, deletedAt: null }, // 已删除的线索不能更新状态
    select: { salesPersonId: true } 
  });
  if (!lead) return; // 线索不存在或已删除
  if (!(await checkCrmPermission(userId, role, lead))) return; // 无权限静默跳过
  await updateLeadStatus(leadId, status);
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard");
}

// 从表单更新线索状态（用于 select 的 form action）
export async function updateLeadStatusFormAction(formData: FormData) {
  const leadId = formData.get("leadId") as string;
  const status = formData.get("status") as string;
  if (!leadId || !status) return;
  await updateLeadStatusAction(leadId, status);
}

// 编辑线索：admin 可编辑全部并修改负责人，sales 仅可编辑自己负责的线索（不可改负责人）
export async function updateLeadAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };

  const leadId = formData.get("leadId") as string;
  if (!leadId) return { error: "缺少线索ID" };

  const lead = await prisma.crm_lead.findUnique({
    where: { id: leadId },
    select: { salesPersonId: true },
  });
  if (!(await checkCrmPermission(userId, role, lead))) {
    return { error: "无权限" };
  }

  const customerNameRaw = (formData.get("customerName") as string) ?? "";
  const customerName = customerNameRaw.trim() ? customerNameRaw.trim() : "（待补全）";

  const salesPersonId =
    role === "admin"
      ? (formData.get("salesPersonId") as string) || null
      : lead?.salesPersonId ?? null;

  await updateLead(leadId, {
    customerName,
    nickname: (formData.get("nickname") as string) || undefined,
    city: (formData.get("city") as string) || undefined,
    address: (formData.get("address") as string) || undefined,
    industry: (formData.get("industry") as string) || undefined,
    leadSource: (formData.get("leadSource") as string) || undefined,
    customerTier: (formData.get("customerTier") as string) || undefined,
    contactPhone: (formData.get("contactPhone") as string) || undefined,
    salesPersonId,
    status: (formData.get("status") as string) || undefined,
  });
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  const isInline = formData.get("inline") === "1";
  if (!isInline) redirect("/dashboard/crm/leads");
  return {};
}

// 软删除线索（仅 admin）：设置 deletedAt，可恢复
export async function softDeleteLeadAction(formData: FormData) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (role !== "admin") return { error: "无权限" };

  const leadId = formData.get("leadId") as string;
  if (!leadId) return { error: "缺少线索ID" };

  const { softDeleteLead } = await import("@/app/lib/crm");
  await softDeleteLead(leadId);
  
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  return { success: true };
}

// 恢复已删除的线索（仅 admin）
export async function restoreLeadAction(formData: FormData) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (role !== "admin") return { error: "无权限" };

  const leadId = formData.get("leadId") as string;
  if (!leadId) return { error: "缺少线索ID" };

  const { restoreLead } = await import("@/app/lib/crm");
  await restoreLead(leadId);
  
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  return { success: true };
}

// 物理删除线索（仅 admin）：强制删除线索，并级联删除关联的商机与客户（谨慎使用）
export async function deleteLeadAction(formData: FormData) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (role !== "admin") return;

  const leadId = formData.get("leadId") as string;
  if (!leadId) return;

  const { deleteLeadWithCascade } = await import("@/app/lib/crm");
  await deleteLeadWithCascade(leadId);
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/permissions");
}

// 批量清理旧的已删除线索（仅 admin）：彻底删除超过指定天数的已删除记录
export async function cleanupOldDeletedLeadsAction(
  daysOld: number = 90
): Promise<{ error: string } | { success: true; count: number; message: string }> {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (role !== "admin") return { error: "无权限" };

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const deletedLeads = await prisma.crm_lead.findMany({
    where: {
      deletedAt: {
        lte: cutoffDate, // 删除时间 <= cutoffDate
        not: null,
      },
    },
    select: { id: true },
  });

  if (deletedLeads.length === 0) {
    return { success: true, count: 0, message: `没有超过 ${daysOld} 天的已删除记录` };
  }

  // 批量物理删除
  const { deleteLeadWithCascade } = await import("@/app/lib/crm");
  for (const lead of deletedLeads) {
    try {
      await deleteLeadWithCascade(lead.id);
    } catch (error) {
      console.error(`清理线索 ${lead.id} 失败:`, error);
    }
  }

  revalidatePath("/dashboard/permissions");
  return { 
    success: true, 
    count: deletedLeads.length, 
    message: `已清理 ${deletedLeads.length} 条超过 ${daysOld} 天的已删除记录` 
  };
}

// 更新线索的销售人员（看板下拉选择后同步到数据库）
export async function updateLeadSalesPersonFormAction(formData: FormData) {
  const leadId = formData.get("leadId") as string;
  const salesPersonId = formData.get("salesPersonId") as string;
  if (!leadId) return;
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return;
  const lead = await prisma.crm_lead.findUnique({ 
    where: { id: leadId, deletedAt: null }, // 已删除的线索不能更新销售人员
    select: { salesPersonId: true } 
  });
  if (!lead) return; // 线索不存在或已删除
  if (!(await checkCrmPermission(userId, role, lead))) return;
  await updateLeadSalesPerson(leadId, salesPersonId || null);
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
}

// 批量指定线索的销售人员（仅 admin），可选发送邮件到销售人员的注册邮箱
export async function batchUpdateLeadSalesPersonAction(
  leadIds: string[],
  salesPersonId: string,
  sendEmail: boolean
): Promise<{ error?: string }> {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (role !== "admin") return { error: "无权限" };
  if (!leadIds?.length || !salesPersonId) return { error: "参数无效" };

  await updateLeadSalesPersonBatch(leadIds, salesPersonId);

  if (sendEmail) {
    const salesPerson = await prisma.users.findUnique({
      where: { id: salesPersonId },
      select: { email: true, name: true },
    });
    if (salesPerson?.email) {
      const leads = await prisma.crm_lead.findMany({
        where: { 
          id: { in: leadIds },
          deletedAt: null, // 只处理未删除的线索
        },
        select: { id: true, customerName: true },
      });
      const result = await sendLeadAssignmentNotification(
        salesPerson.email,
        salesPerson.name,
        leads.map((l) => ({ id: l.id, customerName: l.customerName }))
      );
      if (!result.success) {
        // 邮件发送失败不影响分配，仅记录
        console.error("线索指定邮件发送失败:", result.error);
      }
    }
  }

  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  return {};
}

// 更新商机状态，若为「待签约」或「已赢单」则自动转客户
export async function updateOpportunityStatusAction(
  opportunityId: string,
  status: string,
  lostReason?: string
) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return;
  const opp = await prisma.crm_opportunity.findUnique({
    where: { id: opportunityId },
    select: { salesPersonId: true },
  });
  if (!(await checkCrmPermission(userId, role, opp))) return;
  await updateOpportunityStatus(opportunityId, status, lostReason);
  if (["待签约", "已赢单"].includes(status)) {
    await opportunityToCustomer(opportunityId);
  }
  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard");
}

// 更新商机（编辑/补全商机表单）
export async function updateOpportunityAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };

  const opportunityId = formData.get("opportunityId") as string;
  if (!opportunityId) return { error: "缺少商机ID" };

  const opp = await prisma.crm_opportunity.findUnique({
    where: { id: opportunityId },
    select: { salesPersonId: true },
  });
  if (!(await checkCrmPermission(userId, role, opp))) {
    return { error: "无权限" };
  }

  const name = formData.get("name") as string;
  if (!name?.trim()) return { error: "商机名称必填" };

  const amountStr = formData.get("amount") as string;
  const amount = amountStr ? Number(amountStr) : undefined;

  const expectedCloseDateStr = formData.get("expectedCloseDate") as string;
  const expectedCloseDate = expectedCloseDateStr ? new Date(expectedCloseDateStr) : undefined;

  const contactPhone = (formData.get("contactPhone") as string) ?? "";

  await updateOpportunity(opportunityId, {
    name: name.trim(),
    productType: (formData.get("productType") as string) || undefined,
    status: (formData.get("status") as string) || undefined,
    amount,
    expectedCloseDate,
    salesPersonId: role === "admin" ? ((formData.get("salesPersonId") as string) || undefined) : undefined,
    deliveryPersonId: (formData.get("deliveryPersonId") as string) || undefined,
    contactPhone: contactPhone.trim(),
  });

  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  const isInline = formData.get("inline") === "1";
  if (!isInline) redirect("/dashboard/crm/opportunities");
  return {};
}

// 从表单更新商机状态（用于 select 的 form action）
export async function updateOpportunityStatusFormAction(formData: FormData) {
  const opportunityId = formData.get("opportunityId") as string;
  const status = formData.get("status") as string;
  const lostReason = (formData.get("lostReason") as string) || undefined;
  if (!opportunityId || !status) return;
  await updateOpportunityStatusAction(opportunityId, status, lostReason);
}

// 商机转客户（手动触发）
export async function convertOpportunityToCustomerAction(opportunityId: string) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return;
  const opp = await prisma.crm_opportunity.findUnique({
    where: { id: opportunityId },
    select: { salesPersonId: true },
  });
  if (!(await checkCrmPermission(userId, role, opp))) return;
  await opportunityToCustomer(opportunityId);
  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard");
}

// 创建客户（销售人员从下拉选择，未选则用当前用户）
export async function createCustomerAction(formData: FormData) {
  const name = formData.get("name") as string;
  if (!name?.trim()) return { error: "客户名称必填" };
  const session = await auth();
  let salesPersonId = (formData.get("salesPersonId") as string) || undefined;
  if (!salesPersonId) salesPersonId = (session?.user as { id?: string })?.id ?? undefined;

  await createCustomer({
    name: name.trim(),
    nickname: (formData.get("nickname") as string) || undefined,
    city: (formData.get("city") as string) || undefined,
    customerTier: (formData.get("customerTier") as string) || undefined,
    industry: (formData.get("industry") as string) || undefined,
    employeeCount: (formData.get("employeeCount") as string) || undefined,
    tags: (formData.get("tags") as string) || undefined,
    mainProducts: (formData.get("mainProducts") as string) || undefined,
    status: (formData.get("status") as string) || "已签约",
    actualAmount: undefined,
    salesPersonId,
  });
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard");
  redirect("/dashboard/crm/customers");
}

// 更新客户（表格行内编辑，仅 admin 或该客户负责人可编辑）
export async function updateCustomerAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };

  const customerId = formData.get("customerId") as string;
  if (!customerId) return { error: "缺少客户ID" };

  const customer = await prisma.crm_customer.findUnique({
    where: { id: customerId },
    select: { salesPersonId: true },
  });
  if (!(await checkCrmPermission(userId, role, customer))) {
    return { error: "无权限" };
  }

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "客户名称必填" };

  const firstMaintenanceDateStr = (formData.get("firstMaintenanceDate") as string)?.trim();
  const firstMaintenanceDate = firstMaintenanceDateStr
    ? new Date(firstMaintenanceDateStr)
    : null;

  const actualAmountStr = (formData.get("actualAmount") as string)?.trim();
  const actualAmount = actualAmountStr && actualAmountStr !== "" 
    ? (isNaN(Number(actualAmountStr)) ? null : Number(actualAmountStr))
    : null;

  const contactPhoneRaw = (formData.get("contactPhone") as string) ?? "";
  const contactPhone = contactPhoneRaw.trim();

  await updateCustomer(customerId, {
    name,
    nickname: (formData.get("nickname") as string) || undefined,
    city: (formData.get("city") as string) || undefined,
    customerTier: (formData.get("customerTier") as string) || undefined,
    industry: (formData.get("industry") as string) || undefined,
    firstMaintenanceDate,
    employeeCount: (formData.get("employeeCount") as string) || undefined,
    tags: (formData.get("tags") as string) || undefined,
    mainProducts: (formData.get("mainProducts") as string) || undefined,
    actualAmount,
    contactPhone,
  });

  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard");
  const isInline = formData.get("inline") === "1";
  if (!isInline) redirect("/dashboard/crm/customers");
  return {};
}

/** 仅同步客户名称（用于线索表改完客户名称后询问是否同步到客户表） */
export async function syncLeadNameToCustomerAction(
  customerId: string,
  name: string
): Promise<{ error?: string } | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };

  const trimmed = name?.trim();
  if (!trimmed) return { error: "客户名称不能为空" };

  const customer = await prisma.crm_customer.findUnique({
    where: { id: customerId },
    select: { salesPersonId: true },
  });
  if (!(await checkCrmPermission(userId, role, customer))) {
    return { error: "无权限" };
  }

  await updateCustomer(customerId, { name: trimmed });
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  return {};
}

/** 仅同步客户联系方式（用于线索表改完联系方式后询问是否同步到客户表） */
export async function syncLeadContactPhoneToCustomerAction(
  customerId: string,
  contactPhone: string
): Promise<{ error?: string } | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };

  const customer = await prisma.crm_customer.findUnique({
    where: { id: customerId },
    select: { salesPersonId: true },
  });
  if (!(await checkCrmPermission(userId, role, customer))) {
    return { error: "无权限" };
  }

  await updateCustomer(customerId, { contactPhone: contactPhone?.trim() ?? "" });
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  return {};
}

/** 仅同步商机联系方式（用于线索表改完联系方式后询问是否同步到商机表） */
export async function syncLeadContactPhoneToOpportunityAction(
  opportunityId: string,
  contactPhone: string
): Promise<{ error?: string } | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };

  const opp = await prisma.crm_opportunity.findUnique({
    where: { id: opportunityId },
    select: { salesPersonId: true },
  });
  if (!(await checkCrmPermission(userId, role, opp))) {
    return { error: "无权限" };
  }

  await updateOpportunity(opportunityId, { contactPhone: contactPhone?.trim() ?? "" });
  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  return {};
}

/** 仅同步线索联系方式（用于商机表/客户表改完联系方式后询问是否同步到线索表） */
export async function syncContactPhoneToLeadAction(
  leadId: string,
  contactPhone: string
): Promise<{ error?: string } | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };

  const lead = await prisma.crm_lead.findUnique({
    where: { id: leadId },
    select: { salesPersonId: true },
  });
  if (!(await checkCrmPermission(userId, role, lead))) {
    return { error: "无权限" };
  }

  await updateLead(leadId, { contactPhone: contactPhone?.trim() ?? "" });
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard");
  return {};
}

// 创建跟进记录
export async function createFollowUpAction(prevState: { error?: string } | null, formData: FormData) {
  const content = formData.get("content") as string;
  const followDate = formData.get("followDate") as string;
  const session = await auth();
  let followUpById = (session?.user as { id?: string })?.id;

  // 若 session 无用户 id，使用数据库中第一个用户作为跟进人（开发/单用户场景）
  if (!followUpById) {
    const firstUser = await prisma.users.findFirst({ select: { id: true } });
    followUpById = firstUser?.id;
  }

  if (!content?.trim()) return { error: "跟进内容必填" };
  if (!followDate) return { error: "跟进日期必填" };
  if (!followUpById) return { error: "无法获取跟进人，请先登录或确保数据库中有用户" };

  await createFollowUp({
    content: content.trim(),
    followUpById,
    followDate: new Date(followDate),
    leadId: (formData.get("leadId") as string) || undefined,
    customerId: (formData.get("customerId") as string) || undefined,
    opportunityId: (formData.get("opportunityId") as string) || undefined,
    contactPerson: (formData.get("contactPerson") as string) || undefined,
    summary: (formData.get("summary") as string) || undefined,
    nextStep: (formData.get("nextStep") as string) || undefined,
    customerNeeds: (formData.get("customerNeeds") as string) || undefined,
  });
  revalidatePath("/dashboard/crm/follow-ups");
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard/crm/opportunities");
  redirect("/dashboard/crm/follow-ups");
}

// ============ 跟进记录增强：状态变更时自动创建 ============

/** 线索状态变更时创建跟进记录（前端传入补充说明） */
export async function updateLeadStatusWithFollowUpAction(
  leadId: string,
  newStatus: string,
  followUpContent: string // 前端传入的跟进补充说明（包含默认的状态变更文本）
) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };

  const lead = await prisma.crm_lead.findUnique({
    where: { id: leadId, deletedAt: null }, // 已删除的线索不能更新状态
    include: {
      opportunity: true,
      salesPerson: { select: { id: true } },
    },
  });
  if (!lead) return { error: "线索不存在或已被删除" };
  if (!(await checkCrmPermission(userId, role, { salesPersonId: lead.salesPersonId }))) {
    return { error: "无权限" };
  }

  // 更新状态
  await updateLeadStatus(leadId, newStatus);

  // 如果状态变更为「有意向」且还未创建商机，自动创建商机（默认名称：客户名称-商机）
  if (newStatus === "有意向" && !lead.opportunity) {
    const defaultName = lead.customerName?.trim() ? `${lead.customerName.trim()}-商机` : "（待补全）-商机";
    await createOpportunity({
      name: defaultName,
      leadId: leadId,
      status: "初步沟通",
      salesPersonId: lead.salesPersonId ?? userId,
    });
  }

  // 创建跟进记录
  await createFollowUp({
    content: followUpContent.trim(),
    followUpById: userId,
    followDate: new Date(),
    leadId,
    isSystemGenerated: true, // 标记为状态变更自动生成
  });

  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard");
  return { success: true };
}

/** 线索分配销售人员时创建跟进记录 */
export async function updateLeadSalesPersonWithFollowUpAction(
  leadId: string,
  salesPersonId: string | null,
  followUpContent: string
) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };

  const lead = await prisma.crm_lead.findUnique({
    where: { id: leadId, deletedAt: null }, // 已删除的线索不能更新销售人员
    select: { salesPersonId: true },
  });
  if (!lead || !(await checkCrmPermission(userId, role, lead))) {
    return { error: "无权限或线索不存在" };
  }

  const oldSalesPersonId = lead.salesPersonId;

  // 更新销售人员
  await updateLeadSalesPerson(leadId, salesPersonId);

  // 记录变更通知（如果销售人员发生了变化）
  if (oldSalesPersonId !== salesPersonId) {
    await recordLeadAssignmentChange({
      leadId,
      oldSalesPersonId,
      newSalesPersonId: salesPersonId,
      createdBy: userId,
    });
  }

  // 创建跟进记录（由被分配的销售人员作为跟进人）
  if (salesPersonId && followUpContent.trim()) {
    await createFollowUp({
      content: followUpContent.trim(),
      followUpById: salesPersonId, // 被分配的销售人员
      followDate: new Date(),
      leadId,
      isSystemGenerated: true,
    });
  }

  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  return { success: true };
}

/** 批量分配销售人员时创建跟进记录（更新版本） */
export async function batchUpdateLeadSalesPersonWithFollowUpAction(
  leadIds: string[],
  salesPersonId: string,
  followUpContent: string
): Promise<{
  error?: string;
  salesPersonMap?: Record<
    string,
    { name: string; email: string; leadIds: string[]; leadNames: string[] }
  >;
}> {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };
  if (role !== "admin") return { error: "无权限" };
  if (!leadIds?.length || !salesPersonId) return { error: "参数无效" };

  // 先查询原有的销售人员信息（只查询未删除的线索）
  const oldLeads = await prisma.crm_lead.findMany({
    where: { 
      id: { in: leadIds },
      deletedAt: null, // 只处理未删除的线索
    },
    select: { id: true, customerName: true, salesPersonId: true },
  });

  // 批量更新销售人员
  await updateLeadSalesPersonBatch(leadIds, salesPersonId);

  // 批量记录变更通知
  const leadChanges = oldLeads.map((lead) => ({
    leadId: lead.id,
    oldSalesPersonId: lead.salesPersonId,
    newSalesPersonId: salesPersonId,
  }));
  await recordLeadAssignmentChanges(leadChanges, userId);

  // 为每个线索创建跟进记录
  if (followUpContent.trim()) {
    await Promise.all(
      leadIds.map((leadId) =>
        createFollowUp({
          content: followUpContent.trim(),
          followUpById: salesPersonId,
          followDate: new Date(),
          leadId,
          isSystemGenerated: true,
        })
      )
    );
  }

  // 收集所有受影响的销售人员（新指定的 + 被替换的旧销售）
  const affectedSalesPersonIds = new Set<string>();
  affectedSalesPersonIds.add(salesPersonId); // 新指定的销售

  oldLeads.forEach((lead) => {
    if (lead.salesPersonId && lead.salesPersonId !== salesPersonId) {
      affectedSalesPersonIds.add(lead.salesPersonId); // 被替换的旧销售
    }
  });

  // 查询所有受影响销售人员的信息
  const salesPersons = await prisma.users.findMany({
    where: { id: { in: Array.from(affectedSalesPersonIds) } },
    select: { id: true, name: true, email: true },
  });

  // 构建每个销售人员对应的线索列表
  const salesPersonMap: Record<
    string,
    { name: string; email: string; leadIds: string[]; leadNames: string[] }
  > = {};

  // 为新指定的销售构建数据（显示所有新分配给他的线索）
  const newSalesPerson = salesPersons.find((sp) => sp.id === salesPersonId);
  if (newSalesPerson && newSalesPerson.email) {
    salesPersonMap[salesPersonId] = {
      name: newSalesPerson.name,
      email: newSalesPerson.email,
      leadIds: oldLeads.map((l) => l.id),
      leadNames: oldLeads.map((l) => l.customerName),
    };
  }

  // 为被替换的旧销售构建数据（只显示从他那里被转走的线索）
  const oldSalesPersons = salesPersons.filter((sp) => sp.id !== salesPersonId);
  oldSalesPersons.forEach((sp) => {
    const lostLeads = oldLeads.filter((lead) => lead.salesPersonId === sp.id);
    if (lostLeads.length > 0 && sp.email) {
      salesPersonMap[sp.id] = {
        name: sp.name,
        email: sp.email,
        leadIds: lostLeads.map((l) => l.id),
        leadNames: lostLeads.map((l) => l.customerName),
      };
    }
  });

  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  return { salesPersonMap };
}

/** 批量发送线索指定邮件通知 */
export async function sendBatchLeadAssignmentNotificationsAction(
  salesPersonIds: string[],
  salesPersonMap: Record<
    string,
    { name: string; email: string; leadIds: string[]; leadNames: string[] }
  >
): Promise<{
  success: string[];
  failed: { id: string; name: string; error: string }[];
}> {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (role !== "admin") {
    return { success: [], failed: [] };
  }

  const success: string[] = [];
  const failed: { id: string; name: string; error: string }[] = [];

  await Promise.all(
    salesPersonIds.map(async (id) => {
      const person = salesPersonMap[id];
      if (!person) return;

      const leads = person.leadIds.map((leadId, idx) => ({
        id: leadId,
        customerName: person.leadNames[idx],
      }));

      const result = await sendLeadAssignmentNotification(
        person.email,
        person.name,
        leads
      );

      if (result.success) {
        success.push(id);
      } else {
        failed.push({
          id,
          name: person.name,
          error: result.error || "未知错误",
        });
      }
    })
  );

  return { success, failed };
}

/** 商机状态变更时创建跟进记录 */
export async function updateOpportunityStatusWithFollowUpAction(
  opportunityId: string,
  newStatus: string,
  followUpContent: string,
  lostReason?: string
) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };

  const opp = await prisma.crm_opportunity.findUnique({
    where: { id: opportunityId },
    select: { salesPersonId: true, status: true, amount: true, customer: { select: { id: true } } },
  });
  if (!(await checkCrmPermission(userId, role, opp))) {
    return { error: "无权限" };
  }

   // 不允许状态回退：只能从前面的阶段往后走，不能往回调
   const STATUS_ORDER = ["初步沟通", "方案确认", "待签约", "已赢单", "已丢单"];
   const currentStatus = opp?.status ?? "";
   const currentIndex = STATUS_ORDER.indexOf(currentStatus);
   const newIndex = STATUS_ORDER.indexOf(newStatus);
   if (
     currentStatus &&
     currentIndex !== -1 &&
     newIndex !== -1 &&
     newIndex < currentIndex
   ) {
     return {
       error: `不允许将商机状态从「${currentStatus}」回退到「${newStatus}」，如需修改请联系管理员处理。`,
     };
   }

  // 若要变更为「待签约」，必须先填写商机金额
  if (
    newStatus === "待签约" &&
    (opp?.amount == null || Number(opp.amount) <= 0)
  ) {
    return {
      error: "请先在商机表中填写「金额」，再将状态改为「待签约」",
    };
  }

  // 更新状态
  await updateOpportunityStatus(opportunityId, newStatus, lostReason);

  // 创建跟进记录
  await createFollowUp({
    content: followUpContent.trim(),
    followUpById: userId,
    followDate: new Date(),
    opportunityId,
    isSystemGenerated: true,
  });

  // 若状态为「待签约」或「已赢单」，自动转客户
  if (["待签约", "已赢单"].includes(newStatus)) {
    await opportunityToCustomer(opportunityId);
  }

  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard");
  return { success: true };
}

/** 客户状态变更时创建跟进记录 */
export async function updateCustomerStatusWithFollowUpAction(
  customerId: string,
  newStatus: string,
  followUpContent: string
) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };

  const customer = await prisma.crm_customer.findUnique({
    where: { id: customerId },
    select: { salesPersonId: true, actualAmount: true },
  });
  if (!(await checkCrmPermission(userId, role, customer))) {
    return { error: "无权限" };
  }

  // 若要变更为「已签约」，必须先填写实际成交金额
  if (
    newStatus === "已签约" &&
    (customer?.actualAmount == null || Number(customer.actualAmount) <= 0)
  ) {
    return {
      error: "请先在客户表中填写「实际成交金额」，再将状态改为「已签约」",
    };
  }

  // 更新客户状态
  await prisma.crm_customer.update({
    where: { id: customerId },
    data: { status: newStatus },
  });

  // 创建跟进记录
  await createFollowUp({
    content: followUpContent.trim(),
    followUpById: userId,
    followDate: new Date(),
    customerId,
    isSystemGenerated: true,
  });

  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard");
  return { success: true };
}

/** 手动添加跟进记录（不关联状态变更） */
export async function createManualFollowUpAction(data: {
  content: string;
  leadId?: string;
  customerId?: string;
  opportunityId?: string;
  contactPerson?: string;
  summary?: string;
  nextStep?: string;
  customerNeeds?: string;
}) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return { error: "未登录" };

  await createFollowUp({
    content: data.content.trim(),
    followUpById: userId,
    followDate: new Date(),
    leadId: data.leadId,
    customerId: data.customerId,
    opportunityId: data.opportunityId,
    contactPerson: data.contactPerson,
    summary: data.summary,
    nextStep: data.nextStep,
    customerNeeds: data.customerNeeds,
    isSystemGenerated: false,
  });

  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard/crm/follow-ups");
  return { success: true };
}

/** 更新跟进记录（仅 admin） */
export async function updateFollowUpAction(
  id: string,
  data: {
    content?: string;
    followDate?: string;
    contactPerson?: string;
    summary?: string;
    nextStep?: string;
    customerNeeds?: string;
    status?: string;
  }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (role !== "admin") return { error: "无权限" };
  if (!userId) return { error: "未登录" };

  await updateFollowUp(
    id,
    {
      ...data,
      followDate: data.followDate ? new Date(data.followDate) : undefined,
    },
    userId
  );

  revalidatePath("/dashboard/crm/follow-ups");
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard/crm/opportunities");
  return { success: true };
}

/** 删除跟进记录（仅 admin） */
export async function deleteFollowUpAction(id: string) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (role !== "admin") return { error: "无权限" };

  await deleteFollowUp(id);

  revalidatePath("/dashboard/crm/follow-ups");
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard/crm/opportunities");
  return { success: true };
}

// ============ 线索销售人员变更邮件通知 ============

/** 获取待通知的销售人员列表（按人员分组） */
export async function getPendingNotificationSummaryAction(): Promise<{
  salesPersons: Array<{
    id: string;
    name: string;
    email: string;
    assignedCount: number; // 新接手的线索数
    unassignedCount: number; // 被转走的线索数
  }>;
}> {
  const auth = await getCrmAuth();
  if (!auth) return { salesPersons: [] };

  const notifications = await getPendingNotifications(auth);

  // 按销售人员分组统计
  const groupedMap = new Map<
    string,
    {
      id: string;
      name: string;
      email: string;
      assignedLeads: Array<{ id: string; name: string }>;
      unassignedLeads: Array<{ id: string; name: string }>;
    }
  >();

  notifications.forEach((notif: typeof notifications[0]) => {
    // 新接手的销售人员（newSalesPerson）
    if (notif.newSalesPerson && notif.newSalesPersonId) {
      if (!groupedMap.has(notif.newSalesPersonId)) {
        groupedMap.set(notif.newSalesPersonId, {
          id: notif.newSalesPersonId,
          name: notif.newSalesPerson.name,
          email: notif.newSalesPerson.email || "",
          assignedLeads: [],
          unassignedLeads: [],
        });
      }
      groupedMap.get(notif.newSalesPersonId)!.assignedLeads.push({
        id: notif.lead.id,
        name: notif.lead.customerName,
      });
    }

    // 被转走的销售人员（oldSalesPerson）
    if (notif.oldSalesPerson && notif.oldSalesPersonId) {
      if (!groupedMap.has(notif.oldSalesPersonId)) {
        groupedMap.set(notif.oldSalesPersonId, {
          id: notif.oldSalesPersonId,
          name: notif.oldSalesPerson.name,
          email: notif.oldSalesPerson.email || "",
          assignedLeads: [],
          unassignedLeads: [],
        });
      }
      groupedMap.get(notif.oldSalesPersonId)!.unassignedLeads.push({
        id: notif.lead.id,
        name: notif.lead.customerName,
      });
    }
  });

  const salesPersons = Array.from(groupedMap.values())
    .filter((sp) => sp.email) // 只包含有邮箱的
    .map((sp) => ({
      id: sp.id,
      name: sp.name,
      email: sp.email,
      assignedCount: sp.assignedLeads.length,
      unassignedCount: sp.unassignedLeads.length,
    }));

  return { salesPersons };
}

/** 发送待通知邮件（给选中的销售人员） */
export async function sendPendingNotificationsAction(
  salesPersonIds: string[]
): Promise<{
  success: string[];
  failed: Array<{ id: string; name: string; error: string }>;
}> {
  const auth = await getCrmAuth();
  if (!auth) return { success: [], failed: [] };

  const notifications = await getPendingNotifications(auth);

  // 按销售人员分组
  const groupedMap = new Map<
    string,
    {
      name: string;
      email: string;
      assignedLeads: Array<{ id: string; customerName: string }>;
      unassignedLeads: Array<{ id: string; customerName: string }>;
      notificationIds: string[];
    }
  >();

  notifications.forEach((notif: typeof notifications[0]) => {
    // 新接手的
    if (notif.newSalesPersonId && salesPersonIds.includes(notif.newSalesPersonId)) {
      if (!groupedMap.has(notif.newSalesPersonId)) {
        groupedMap.set(notif.newSalesPersonId, {
          name: notif.newSalesPerson!.name,
          email: notif.newSalesPerson!.email || "",
          assignedLeads: [],
          unassignedLeads: [],
          notificationIds: [],
        });
      }
      const group = groupedMap.get(notif.newSalesPersonId)!;
      group.assignedLeads.push({
        id: notif.lead.id,
        customerName: notif.lead.customerName,
      });
      group.notificationIds.push(notif.id);
    }

    // 被转走的
    if (notif.oldSalesPersonId && salesPersonIds.includes(notif.oldSalesPersonId)) {
      if (!groupedMap.has(notif.oldSalesPersonId)) {
        groupedMap.set(notif.oldSalesPersonId, {
          name: notif.oldSalesPerson!.name,
          email: notif.oldSalesPerson!.email || "",
          assignedLeads: [],
          unassignedLeads: [],
          notificationIds: [],
        });
      }
      const group = groupedMap.get(notif.oldSalesPersonId)!;
      group.unassignedLeads.push({
        id: notif.lead.id,
        customerName: notif.lead.customerName,
      });
      group.notificationIds.push(notif.id);
    }
  });

  const success: string[] = [];
  const failed: Array<{ id: string; name: string; error: string }> = [];

  // 逐个发送邮件
  for (const [salesPersonId, group] of groupedMap.entries()) {
    if (!group.email) {
      failed.push({ id: salesPersonId, name: group.name, error: "邮箱为空" });
      continue;
    }

    // 调用发送邮件（分别传递新接手和被转走的线索）
    const result = await sendLeadAssignmentNotification(
      group.email,
      group.name,
      group.assignedLeads,
      group.unassignedLeads
    );

    if (result.success) {
      success.push(salesPersonId);
      // 标记为已发送
      await markNotificationsAsSent(group.notificationIds);
    } else {
      failed.push({
        id: salesPersonId,
        name: group.name,
        error: result.error || "未知错误",
      });
    }
  }

  return { success, failed };
}
