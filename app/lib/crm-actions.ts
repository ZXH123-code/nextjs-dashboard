"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

async function checkCrmPermission(
  userId: string,
  role: string,
  record: { salesPersonId?: string | null; assigneeIds?: string[] } | null
): Promise<boolean> {
  if (!record) return false;
  if (role === "admin") return true;
  if (record.assigneeIds?.length) return record.assigneeIds.includes(userId);
  return record.salesPersonId === userId;
}

/** 商机/客户：多负责人 assignee 表 + 主负责人 salesPersonId */
function crmSalesPermRecord(
  row: { salesPersonId: string | null; assignees: { userId: string }[] } | null
) {
  if (!row) return null;
  const assigneeIds = row.assignees.map((a) => a.userId);
  return {
    salesPersonId: row.salesPersonId,
    assigneeIds: assigneeIds.length ? assigneeIds : undefined,
  };
}
import {
  createLead,
  createOpportunity,
  createFollowUp,
  syncDealSalesAssignees,
  syncOppCustomerAssigneesWithoutLead,
  normalizeDealAssigneeUserIds,
  CRM_ASSIGNEE_MIN_ONE_ERROR,
  updateCustomer,
  updateLead,
  updateLeadStatus,
  setLeadAssignees,
  addLeadAssigneeBatch,
  updateCustomerSalesPersonBatch,
  deleteCustomers,
  deleteLead,
  updateOpportunity,
  updateOpportunityStatus,
  opportunityToCustomer,
  updateFollowUp,
  deleteFollowUp,
  recordLeadAssignmentChange,
  setLeadKeyFocus,
  recordLeadAssignmentChanges,
  getPendingNotifications,
  markNotificationsAsSent,
  getNotificationsForUser,
  getCrmAuth,
  getFollowUpByIdIfVisible,
  globalSearchCrm,
  getLeadIds,
  getPageForNewLead,
} from "./crm";
import type { LeadFilter } from "./crm";
import { sendLeadAssignmentNotification } from "./email";

// 创建线索：admin 可指定负责人，sales 新建时负责人固定为自己
export async function createLeadAction(formData: FormData) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "请先登录" };

  const customerName = formData.get("customerName") as string;
  if (!customerName?.trim()) return { error: "客户名称必填" };
  // 兼容旧表单字段：仍可从 salesPersonId 读入，写入新模型的 assigneeIds
  const legacySalesPersonId =
    role === "admin" ? ((formData.get("salesPersonId") as string) || "") : userId;
  const assigneeIds = legacySalesPersonId ? [legacySalesPersonId] : role === "sales" ? [userId] : [];

  await createLead({
    customerName: customerName.trim(),
    nickname: (formData.get("nickname") as string) || undefined,
    contactPerson: (formData.get("contactPerson") as string) || undefined,
    contactEmail: (formData.get("contactEmail") as string) || undefined,
    city: (formData.get("city") as string) || undefined,
    address: (formData.get("address") as string) || undefined,
    industry: (formData.get("industry") as string) || undefined,
    leadSource: (formData.get("leadSource") as string) || undefined,
    customerTier: (formData.get("customerTier") as string) || undefined,
    contactPhone: (formData.get("contactPhone") as string) || undefined,
    remark: (formData.get("remark") as string) || undefined,
    status: (formData.get("status") as string) || "未跟进",
    assigneeIds,
  });
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  redirect("/dashboard/crm/leads");
}

function decodeFilter(filterStr: string | undefined): LeadFilter | undefined {
  if (!filterStr?.trim()) return undefined;
  try {
    const decoded = decodeURIComponent(filterStr);
    const parsed = JSON.parse(decoded) as LeadFilter;
    return parsed?.groups ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** 新建一条空线索，用于表格内直接增加一行并行内编辑。admin 可不指定负责人，sales 默认为自己 */
export async function createEmptyLeadAction(options?: {
  pageSize?: number;
  filterParam?: string;
}): Promise<{ error?: string; leadId?: string; page?: number }> {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "请先登录" };

  const lead = await createLead({
    customerName: "（待补全）",
    status: "未跟进",
    assigneeIds: role === "sales" ? [userId] : [],
  });
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");

  let page = 1;
  if (options?.pageSize != null && options.pageSize >= 1) {
    const auth = await getCrmAuth();
    const filter = decodeFilter(options.filterParam);
    page = await getPageForNewLead(auth, filter, options.pageSize);
  }
  return { leadId: lead.id, page };
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
    select: { assignees: { select: { userId: true } } },
  });
  const assigneeIds = lead?.assignees?.map((a) => a.userId) ?? [];
  if (!(await checkCrmPermission(userId, role, { assigneeIds }))) {
    return { error: "无权限" };
  }

  const customerNameRaw = (formData.get("customerName") as string) ?? "";
  const customerName = customerNameRaw.trim() ? customerNameRaw.trim() : "（待补全）";

  await updateLead(leadId, {
    customerName,
    nickname: (formData.get("nickname") as string) || undefined,
    contactPerson: (formData.get("contactPerson") as string) || undefined,
    contactEmail: (formData.get("contactEmail") as string) || undefined,
    city: (formData.get("city") as string) || undefined,
    address: (formData.get("address") as string) || undefined,
    industry: (formData.get("industry") as string) || undefined,
    leadSource: (formData.get("leadSource") as string) || undefined,
    customerTier: (formData.get("customerTier") as string) || undefined,
    contactPhone: (formData.get("contactPhone") as string) || undefined,
    remark: (formData.get("remark") as string) || undefined,
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

// 批量软删除线索（仅 admin）：选中线索移入回收站，可恢复
export async function batchSoftDeleteLeadsAction(
  leadIds: string[]
): Promise<{ error?: string } | { success: true; count: number }> {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (role !== "admin") return { error: "无权限" };
  if (!leadIds?.length) return { error: "请选择至少一条线索" };

  const { softDeleteLead } = await import("@/app/lib/crm");
  let count = 0;
  for (const leadId of leadIds) {
    const lead = await prisma.crm_lead.findUnique({
      where: { id: leadId, deletedAt: null },
      select: { id: true },
    });
    if (lead) {
      await softDeleteLead(leadId);
      count += 1;
    }
  }
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  return { success: true, count };
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

// 标记/取消线索为重点关注（admin 可操作全部，sales 仅可操作自己负责的线索），并同步到派生商机、客户
export async function toggleLeadKeyFocusAction(leadId: string): Promise<{ error?: string } | { success: true; isKeyFocus: boolean }> {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };
  if (!leadId) return { error: "缺少线索ID" };

  const leadRow = await prisma.crm_lead.findUnique({
    where: { id: leadId, deletedAt: null },
    select: { isKeyFocus: true, assignees: { select: { userId: true } } },
  });
  if (!leadRow) return { error: "线索不存在或已删除" };
  const assigneeIds = leadRow.assignees.map((a) => a.userId);
  const canEdit = role === "admin" || assigneeIds.includes(userId);
  if (!canEdit) return { error: "无权限操作该线索" };

  const next = !leadRow.isKeyFocus;
  await setLeadKeyFocus(leadId, next, role === "admin");
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard");
  return { success: true, isKeyFocus: next };
}

// 批量设置线索为重点关注/取消重点关注（admin 可操作全部，sales 仅可操作自己负责的线索），并同步到派生商机、客户
export async function batchSetLeadKeyFocusAction(
  leadIds: string[],
  isKeyFocus: boolean
): Promise<{ error?: string } | { success: true; count: number }> {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };
  if (!leadIds?.length) return { error: "请选择至少一条线索" };

  const where: Prisma.crm_leadWhereInput = {
    id: { in: leadIds },
    deletedAt: null,
    ...(role === "sales" && {
      assignees: { some: { userId } },
      keyFocusByAdmin: false, // sales 只能批量操作非管理员标的线索
    }),
  };

  const allowed = await prisma.crm_lead.findMany({
    where,
    select: { id: true },
  });
  let count = 0;
  const byAdmin = role === "admin";
  for (const lead of allowed) {
    await setLeadKeyFocus(lead.id, isKeyFocus, byAdmin);
    count += 1;
  }
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard");
  return { success: true, count };
}

/** 分配至本月计划：将勾选的线索加入指定跟进人的本月计划，并同步更新线索负责人（仅 admin） */
export async function addLeadsToMonthlyPlanAction(
  leadIds: string[],
  userIds: string[]
): Promise<{ error?: string } | { success: true; count: number }> {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (role !== "admin") return { error: "仅管理员可分配本月计划" };
  if (!leadIds?.length || !userIds?.length) return { error: "请选择线索并指定至少一位跟进人" };

  const planMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const records: { leadId: string; userId: string; planMonth: string }[] = [];
  for (const leadId of leadIds) {
    for (const userId of userIds) {
      records.push({ leadId, userId, planMonth });
    }
  }

  await prisma.crm_monthly_plan_lead.createMany({
    data: records,
    skipDuplicates: true,
  });

  // 追加负责人，不覆盖原有（多人共同负责）
  const assigneeIds = Array.from(new Set(userIds.filter(Boolean)));
  for (const userId of assigneeIds) {
    await addLeadAssigneeBatch(leadIds, userId);
  }

  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/monthly-plan");
  revalidatePath("/dashboard");
  return { success: true, count: leadIds.length };
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
  if (role !== "admin") return;
  const lead = await prisma.crm_lead.findUnique({
    where: { id: leadId, deletedAt: null }, // 已删除的线索不能更新销售人员
    select: { id: true }
  });
  if (!lead) return; // 线索不存在或已删除
  await setLeadAssignees(leadId, salesPersonId ? [salesPersonId] : []);
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

  // 多负责人模式下：批量「追加」负责人（不影响已有负责人）
  const validLeads = await prisma.crm_lead.findMany({
    where: { id: { in: leadIds }, deletedAt: null },
    select: { id: true },
  });
  const validIds = validLeads.map((l) => l.id);
  await addLeadAssigneeBatch(validIds, salesPersonId);

  if (sendEmail) {
    const salesPerson = await prisma.users.findUnique({
      where: { id: salesPersonId },
      select: { email: true, name: true },
    });
    if (salesPerson?.email) {
      const leads = await prisma.crm_lead.findMany({
        where: {
          id: { in: validIds },
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
    select: { salesPersonId: true, assignees: { select: { userId: true } } },
  });
  if (!(await checkCrmPermission(userId, role, crmSalesPermRecord(opp)))) return;
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
    select: { salesPersonId: true, assignees: { select: { userId: true } } },
  });
  if (!(await checkCrmPermission(userId, role, crmSalesPermRecord(opp)))) {
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

/** 管理员：按商机维度全量设置销售负责人（同步线索/客户 assignee 集合） */
export async function setDealAssigneesByOpportunityAction(
  opportunityId: string,
  assigneeIds: string[],
  followUpContent: string
): Promise<{ error?: string } | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };
  if (role !== "admin") return { error: "无权限" };

  const opp = await prisma.crm_opportunity.findUnique({
    where: { id: opportunityId },
    select: { leadId: true, name: true },
  });
  if (!opp) return { error: "商机不存在" };

  const ids = normalizeDealAssigneeUserIds(assigneeIds);
  if (ids.length === 0) return { error: CRM_ASSIGNEE_MIN_ONE_ERROR };

  try {
    if (opp.leadId) {
      await syncDealSalesAssignees(opp.leadId, ids);
    } else {
      await syncOppCustomerAssigneesWithoutLead(opportunityId, ids);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }

  const content = followUpContent.trim();
  if (content) {
    await createFollowUp({
      content,
      followUpById: userId,
      followDate: new Date(),
      opportunityId,
      isSystemGenerated: true,
    });
  }

  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard/crm/pending-customers");
  revalidatePath("/dashboard");
  return {};
}

/** 管理员：按客户维度全量设置销售负责人（同步整条漏斗） */
export async function setDealAssigneesByCustomerAction(
  customerId: string,
  assigneeIds: string[],
  followUpContent: string
): Promise<{ error?: string } | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };
  if (role !== "admin") return { error: "无权限" };

  const customer = await prisma.crm_customer.findUnique({
    where: { id: customerId },
    select: { opportunity: { select: { id: true, leadId: true } } },
  });
  if (!customer) return { error: "客户不存在" };

  const ids = normalizeDealAssigneeUserIds(assigneeIds);
  if (ids.length === 0) return { error: CRM_ASSIGNEE_MIN_ONE_ERROR };

  try {
    const leadId = customer.opportunity?.leadId;
    if (leadId) {
      await syncDealSalesAssignees(leadId, ids);
    } else if (customer.opportunity?.id) {
      await syncOppCustomerAssigneesWithoutLead(customer.opportunity.id, ids);
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.crm_customer_assignee.deleteMany({ where: { customerId } });
        await tx.crm_customer_assignee.createMany({
          data: ids.map((uid) => ({ customerId, userId: uid })),
          skipDuplicates: true,
        });
        await tx.crm_customer.update({
          where: { id: customerId },
          data: { salesPersonId: ids[0]! },
        });
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }

  const content = followUpContent.trim();
  if (content) {
    await createFollowUp({
      content,
      followUpById: userId,
      followDate: new Date(),
      customerId,
      isSystemGenerated: true,
    });
  }

  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard/crm/pending-customers");
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard");
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
    select: { salesPersonId: true, assignees: { select: { userId: true } } },
  });
  if (!(await checkCrmPermission(userId, role, crmSalesPermRecord(opp)))) return;
  await opportunityToCustomer(opportunityId);
  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard");
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
    select: { salesPersonId: true, assignees: { select: { userId: true } } },
  });
  if (!(await checkCrmPermission(userId, role, crmSalesPermRecord(customer)))) {
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

  const signedAtStr = (formData.get("signedAt") as string)?.trim();
  const signedAt = signedAtStr ? new Date(signedAtStr) : null;

  await updateCustomer(customerId, {
    name,
    nickname: (formData.get("nickname") as string) || undefined,
    city: (formData.get("city") as string) || undefined,
    industry: (formData.get("industry") as string) || undefined,
    firstMaintenanceDate,
    employeeCount: (formData.get("employeeCount") as string) || undefined,
    tags: (formData.get("tags") as string) || undefined,
    mainProducts: (formData.get("mainProducts") as string) || undefined,
    actualAmount,
    ...(formData.has("signedAt") && { signedAt }),
    contactPhone,
  });

  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard/crm/pending-customers");
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
    select: { salesPersonId: true, assignees: { select: { userId: true } } },
  });
  if (!(await checkCrmPermission(userId, role, crmSalesPermRecord(customer)))) {
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
    select: { salesPersonId: true, assignees: { select: { userId: true } } },
  });
  if (!(await checkCrmPermission(userId, role, crmSalesPermRecord(customer)))) {
    return { error: "无权限" };
  }

  await updateCustomer(customerId, { contactPhone: contactPhone?.trim() ?? "" });
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  return {};
}

/** 批量追加客户负责人（在现有多负责人基础上追加；仅 admin 或当前为客户负责人可操作对应记录） */
export async function batchUpdateCustomerSalesPersonAction(
  customerIds: string[],
  salesPersonId: string
): Promise<{ error?: string } | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };
  if (!customerIds.length) return { error: "请选择要追加负责人的客户" };

  const customers = await prisma.crm_customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, salesPersonId: true, assignees: { select: { userId: true } } },
  });
  const allowedIds: string[] = [];
  for (const c of customers) {
    if (await checkCrmPermission(userId, role, crmSalesPermRecord(c))) allowedIds.push(c.id);
  }
  if (allowedIds.length === 0) return { error: "无权限操作所选客户" };

  await updateCustomerSalesPersonBatch(allowedIds, salesPersonId);
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard");
  return {};
}

/** 批量删除客户（仅 admin 或当前为客户负责人可操作对应记录；跟进记录会保留但解除客户关联） */
export async function batchDeleteCustomersAction(
  customerIds: string[]
): Promise<{ error?: string } | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };
  if (!customerIds.length) return { error: "请选择要删除的客户" };

  const customers = await prisma.crm_customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, salesPersonId: true, assignees: { select: { userId: true } } },
  });
  const allowedIds: string[] = [];
  for (const c of customers) {
    if (await checkCrmPermission(userId, role, crmSalesPermRecord(c))) allowedIds.push(c.id);
  }
  if (allowedIds.length === 0) return { error: "无权限操作所选客户" };

  await deleteCustomers(allowedIds);
  revalidatePath("/dashboard/crm/customers");
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
    select: { salesPersonId: true, assignees: { select: { userId: true } } },
  });
  if (!(await checkCrmPermission(userId, role, crmSalesPermRecord(opp)))) {
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
    select: { assignees: { select: { userId: true } } },
  });
  const assigneeIds = lead?.assignees?.map((a) => a.userId) ?? [];
  if (!(await checkCrmPermission(userId, role, { assigneeIds }))) {
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
  const role = (session?.user as { role?: string })?.role ?? "sales";
  let followUpById = (session?.user as { id?: string })?.id;

  // 若 session 无用户 id，使用数据库中第一个用户作为跟进人（开发/单用户场景）
  if (!followUpById) {
    const firstUser = await prisma.users.findFirst({ select: { id: true } });
    followUpById = firstUser?.id;
  }

  if (!content?.trim()) return { error: "跟进内容必填" };
  if (!followDate) return { error: "跟进日期必填" };
  if (!followUpById) return { error: "无法获取跟进人，请先登录或确保数据库中有用户" };

  const leadId = (formData.get("leadId") as string)?.trim() || undefined;
  const customerId = (formData.get("customerId") as string)?.trim() || undefined;
  const opportunityId = (formData.get("opportunityId") as string)?.trim() || undefined;
  if (!leadId && !customerId && !opportunityId) {
    return { error: "请至少选择关联的线索、商机或客户之一" };
  }

  // 服务端权限校验：sales 仅能对「自己可见」的记录写跟进
  if (role !== "admin") {
    const userId = followUpById;
    if (!userId) return { error: "未登录" };
    if (leadId) {
      const lead = await prisma.crm_lead.findUnique({
        where: { id: leadId, deletedAt: null },
        select: { assignees: { where: { userId }, select: { userId: true } } },
      });
      if (!lead?.assignees?.length) return { error: "无权限关联该线索" };
    }
    if (customerId) {
      const customer = await prisma.crm_customer.findUnique({
        where: { id: customerId },
        select: { salesPersonId: true, assignees: { select: { userId: true } } },
      });
      if (!(await checkCrmPermission(userId, role, crmSalesPermRecord(customer)))) {
        return { error: "无权限关联该客户" };
      }
    }
    if (opportunityId) {
      const opp = await prisma.crm_opportunity.findUnique({
        where: { id: opportunityId },
        select: { salesPersonId: true, assignees: { select: { userId: true } } },
      });
      if (!(await checkCrmPermission(userId, role, crmSalesPermRecord(opp)))) {
        return { error: "无权限关联该商机" };
      }
    }
  }

  const created = await createFollowUp({
    content: content.trim(),
    followUpById,
    followDate: new Date(followDate),
    leadId,
    customerId,
    opportunityId,
    contactPerson: (formData.get("contactPerson") as string) || undefined,
    summary: (formData.get("summary") as string) || undefined,
    nextStep: (formData.get("nextStep") as string) || undefined,
    customerNeeds: (formData.get("customerNeeds") as string) || undefined,
  });
  revalidatePath("/dashboard/crm/follow-ups");
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard/crm/opportunities");
  return { success: true, followUpId: created.id };
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
      assignees: { orderBy: { createdAt: "asc" }, select: { userId: true } },
    },
  });
  if (!lead) return { error: "线索不存在或已被删除" };
  const assigneeIds = lead.assignees.map((a) => a.userId);
  if (!(await checkCrmPermission(userId, role, { assigneeIds }))) {
    return { error: "无权限" };
  }

  // 更新状态
  await updateLeadStatus(leadId, newStatus);

  // 如果状态变更为「有意向」且还未创建商机，自动创建商机（默认名称：客户名称-商机）
  if (newStatus === "有意向" && !lead.opportunity) {
    const defaultName = lead.customerName?.trim() ? `${lead.customerName.trim()}-商机` : "（待补全）-商机";
    const primaryAssigneeId = lead.assignees?.[0]?.userId ?? userId;
    await createOpportunity({
      name: defaultName,
      leadId: leadId,
      status: "初步沟通",
      salesPersonId: primaryAssigneeId,
    });
  }

  // 创建跟进记录（若本次触发了自动建商机，则标记为「线索转商机」以便删除时联动撤回）
  const didCreateOpportunity = newStatus === "有意向" && !lead.opportunity;
  await createFollowUp({
    content: followUpContent.trim(),
    followUpById: userId,
    followDate: new Date(),
    leadId,
    isSystemGenerated: true, // 标记为状态变更自动生成
    transitionType: didCreateOpportunity ? "lead_to_opportunity" : null,
  });

  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard");
  return { success: true };
}

/** 设置线索负责人列表并创建跟进记录（仅 admin） */
export async function setLeadAssigneesWithFollowUpAction(
  leadId: string,
  assigneeIds: string[],
  followUpContent: string
) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };
  if (role !== "admin") return { error: "无权限" };

  const lead = await prisma.crm_lead.findUnique({
    where: { id: leadId, deletedAt: null },
    include: { assignees: { select: { userId: true } } },
  });
  if (!lead) return { error: "线索不存在或已被删除" };

  const oldIds = new Set(lead.assignees.map((a) => a.userId));
  const newIds = Array.from(new Set((assigneeIds ?? []).filter(Boolean)));
  if (newIds.length === 0) return { error: CRM_ASSIGNEE_MIN_ONE_ERROR };

  try {
    await setLeadAssignees(leadId, newIds);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[setLeadAssignees] 写入失败:", msg);
    return { error: `负责人更新失败：${msg}` };
  }

  // 记录变更通知：新增/移除负责人
  const newSet = new Set(newIds);
  const added = newIds.filter((id) => !oldIds.has(id));
  const removed = Array.from(oldIds).filter((id) => !newSet.has(id));
  await Promise.all([
    ...added.map((id) =>
      recordLeadAssignmentChange({
        leadId,
        oldSalesPersonId: null,
        newSalesPersonId: id,
        createdBy: userId,
      })
    ),
    ...removed.map((id) =>
      recordLeadAssignmentChange({
        leadId,
        oldSalesPersonId: id,
        newSalesPersonId: null,
        createdBy: userId,
      })
    ),
  ]);

  // 创建跟进记录（由操作人作为跟进人）
  if (followUpContent.trim()) {
    await createFollowUp({
      content: followUpContent.trim(),
      followUpById: userId,
      followDate: new Date(),
      leadId,
      isSystemGenerated: true,
    });
  }

  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard/crm/pending-customers");
  revalidatePath("/dashboard");
  return { success: true };
}

/** 兼容旧接口：单负责人选择（会覆盖为 1 个负责人） */
export async function updateLeadSalesPersonWithFollowUpAction(
  leadId: string,
  salesPersonId: string | null,
  followUpContent: string
) {
  if (!salesPersonId) return { error: CRM_ASSIGNEE_MIN_ONE_ERROR };
  return setLeadAssigneesWithFollowUpAction(leadId, [salesPersonId], followUpContent);
}

function decodeLeadFilter(filterParam: string | undefined): LeadFilter | undefined {
  if (!filterParam?.trim()) return undefined;
  try {
    const decoded = decodeURIComponent(filterParam);
    const parsed = JSON.parse(decoded) as LeadFilter;
    if (!parsed?.groups) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

/** 按当前筛选条件返回线索 id 列表（用于「全选」），供前端多选用 */
export async function getLeadIdsAction(
  filterParam: string | undefined
): Promise<{ error?: string } | { ids: string[]; total: number }> {
  const auth = await getCrmAuth();
  if (!auth) return { error: "请先登录" };
  const filter = decodeLeadFilter(filterParam);
  const { ids, total } = await getLeadIds(auth, filter);
  return { ids, total };
}

/** 批量「追加」负责人并创建跟进记录（仅 admin）。已包含该负责人的线索会跳过。 */
export async function batchUpdateLeadSalesPersonWithFollowUpAction(
  leadIds: string[],
  salesPersonId: string,
  followUpContent: string
): Promise<{
  error?: string;
  updatedCount?: number;
  skippedCount?: number;
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

  // 只处理未删除的线索
  const leads = await prisma.crm_lead.findMany({
    where: { id: { in: leadIds }, deletedAt: null },
    select: { id: true, customerName: true },
  });
  if (leads.length === 0) {
    revalidatePath("/dashboard/crm/leads");
    revalidatePath("/dashboard");
    return { updatedCount: 0, skippedCount: leadIds.length, salesPersonMap: {} };
  }

  // 查出哪些线索已包含该负责人
  const already = await prisma.crm_lead_assignee.findMany({
    where: { leadId: { in: leads.map((l) => l.id) }, userId: salesPersonId },
    select: { leadId: true },
  });
  const alreadySet = new Set(already.map((r) => r.leadId));
  const leadsToUpdate = leads.filter((l) => !alreadySet.has(l.id));
  const skippedCount = leads.length - leadsToUpdate.length;

  if (leadsToUpdate.length === 0) {
    revalidatePath("/dashboard/crm/leads");
    revalidatePath("/dashboard");
    return { updatedCount: 0, skippedCount, salesPersonMap: {} };
  }

  const idsToUpdate = leadsToUpdate.map((l) => l.id);

  // 批量追加负责人
  await addLeadAssigneeBatch(idsToUpdate, salesPersonId);

  // 记录变更通知：为每条线索新增一条“assigned”
  await Promise.all(
    idsToUpdate.map((leadId) =>
      recordLeadAssignmentChange({
        leadId,
        oldSalesPersonId: null,
        newSalesPersonId: salesPersonId,
        createdBy: userId,
      })
    )
  );

  // 创建跟进记录（由操作人作为跟进人）
  if (followUpContent.trim()) {
    await Promise.all(
      idsToUpdate.map((leadId) =>
        createFollowUp({
          content: followUpContent.trim(),
          followUpById: userId,
          followDate: new Date(),
          leadId,
          isSystemGenerated: true,
        })
      )
    );
  }

  // 收集邮件通知数据（仅本次新增的负责人）
  const person = await prisma.users.findUnique({
    where: { id: salesPersonId },
    select: { id: true, name: true, email: true },
  });

  const salesPersonMap: Record<
    string,
    { name: string; email: string; leadIds: string[]; leadNames: string[] }
  > = {};
  if (person?.email) {
    salesPersonMap[salesPersonId] = {
      name: person.name,
      email: person.email,
      leadIds: leadsToUpdate.map((l) => l.id),
      leadNames: leadsToUpdate.map((l) => l.customerName),
    };
  }

  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  return {
    salesPersonMap,
    updatedCount: leadsToUpdate.length,
    skippedCount,
  };
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
    select: {
      salesPersonId: true,
      status: true,
      customer: { select: { id: true } },
      assignees: { select: { userId: true } },
    },
  });
  if (!(await checkCrmPermission(userId, role, crmSalesPermRecord(opp)))) {
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

  // 更新状态
  await updateOpportunityStatus(opportunityId, newStatus, lostReason);

  // 创建跟进记录（若本次会转客户，则标记为「商机转客户」以便删除时联动撤回）
  const willCreateCustomer = ["待签约", "已赢单"].includes(newStatus);
  await createFollowUp({
    content: followUpContent.trim(),
    followUpById: userId,
    followDate: new Date(),
    opportunityId,
    isSystemGenerated: true,
    transitionType: willCreateCustomer ? "opportunity_to_customer" : null,
  });

  // 若状态为「待签约」或「已赢单」，自动转客户
  if (willCreateCustomer) {
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
    select: { salesPersonId: true, assignees: { select: { userId: true } } },
  });
  if (!(await checkCrmPermission(userId, role, crmSalesPermRecord(customer)))) {
    return { error: "无权限" };
  }

  // 更新客户状态；状态变为「已签约」时自动填充签约日期
  await prisma.crm_customer.update({
    where: { id: customerId },
    data: {
      status: newStatus,
      ...(newStatus === "已签约" && { signedAt: new Date() }),
    },
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
  revalidatePath("/dashboard/crm/pending-customers");
  revalidatePath("/dashboard");
  return { success: true };
}

/** 手动添加跟进记录（不关联状态变更），返回 followUpId 便于前端上传图片 */
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
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return { error: "未登录" };
  if (!data.leadId && !data.customerId && !data.opportunityId) {
    return { error: "请至少选择关联的线索、商机或客户之一" };
  }

  if (role !== "admin") {
    if (data.leadId) {
      const lead = await prisma.crm_lead.findUnique({
        where: { id: data.leadId, deletedAt: null },
        select: { assignees: { where: { userId }, select: { userId: true } } },
      });
      if (!lead?.assignees?.length) return { error: "无权限关联该线索" };
    }
    if (data.customerId) {
      const customer = await prisma.crm_customer.findUnique({
        where: { id: data.customerId },
        select: { salesPersonId: true, assignees: { select: { userId: true } } },
      });
      if (!(await checkCrmPermission(userId, role, crmSalesPermRecord(customer)))) {
        return { error: "无权限关联该客户" };
      }
    }
    if (data.opportunityId) {
      const opp = await prisma.crm_opportunity.findUnique({
        where: { id: data.opportunityId },
        select: { salesPersonId: true, assignees: { select: { userId: true } } },
      });
      if (!(await checkCrmPermission(userId, role, crmSalesPermRecord(opp)))) {
        return { error: "无权限关联该商机" };
      }
    }
  }

  const created = await createFollowUp({
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
  return { success: true, followUpId: created.id };
}

/** 更新跟进记录：仅管理员或该条跟进的创建者可编辑（描述与可选字段，用于修正或补充） */
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
  const crmAuth = await getCrmAuth();
  if (!crmAuth) return { error: "未登录" };
  const { userId, role } = crmAuth;
  const row = await getFollowUpByIdIfVisible(crmAuth, id);
  if (!row) return { error: "跟进不存在或无权限" };
  if (role !== "admin" && row.followUpById !== userId) return { error: "仅管理员或该条跟进创建者可编辑" };

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

/** 删除跟进记录：仅管理员或该条创建者可删；状态变更记录不可删（保留链条），请用编辑修正 */
export async function deleteFollowUpAction(id: string) {
  const crmAuth = await getCrmAuth();
  if (!crmAuth) return { error: "请先登录" };
  const { userId, role } = crmAuth;

  const row = await getFollowUpByIdIfVisible(crmAuth, id);
  if (!row) return { error: "跟进不存在或无权限" };
  if (role !== "admin" && row.followUpById !== userId) return { error: "仅管理员或该条跟进创建者可删除" };

  if (row.transitionType) {
    return { error: "状态变更记录不可删除，请使用「编辑」修正描述或补充信息。" };
  }

  await deleteFollowUp(id);

  revalidatePath("/dashboard/crm/follow-ups");
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard/crm/opportunities");
  return { success: true };
}

// ============ 线索销售人员变更邮件通知 ============

type NotificationWithLead = Awaited<ReturnType<typeof getPendingNotifications>>[number];

/**
 * 按「净效果」聚合：同一线索多次转手（如 A→B→A）只算一次，仅按起始负责人与最终负责人统计。
 * 避免循环指派时出现「被转走很多条、新接手很多条」的重复计数。
 */
function aggregateNotificationsByNetEffect(notifications: NotificationWithLead[]) {
  const byLead = new Map<string, NotificationWithLead[]>();
  for (const n of notifications) {
    const leadId = n.leadId;
    if (!byLead.has(leadId)) byLead.set(leadId, []);
    byLead.get(leadId)!.push(n);
  }

  const netAssigned = new Map<string, Array<{ id: string; customerName: string }>>();
  const netUnassigned = new Map<string, Array<{ id: string; customerName: string }>>();
  const personInfo = new Map<string, { name: string; email: string }>();

  for (const [, list] of byLead) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const start = sorted[0].oldSalesPersonId ?? null;
    const end = sorted[sorted.length - 1].newSalesPersonId ?? null;
    const leadInfo = { id: sorted[0].lead.id, customerName: sorted[0].lead.customerName };

    if (end && start !== end) {
      if (!netAssigned.has(end)) netAssigned.set(end, []);
      netAssigned.get(end)!.push(leadInfo);
      const p = sorted[sorted.length - 1].newSalesPerson;
      if (p) personInfo.set(end, { name: p.name, email: p.email ?? "" });
    }
    if (start && start !== end) {
      if (!netUnassigned.has(start)) netUnassigned.set(start, []);
      netUnassigned.get(start)!.push(leadInfo);
      const p = sorted[0].oldSalesPerson;
      if (p) personInfo.set(start, { name: p.name, email: p.email ?? "" });
    }
  }

  return { netAssigned, netUnassigned, personInfo };
}

/** 获取待通知的销售人员列表（按人员分组，按净效果统计） */
export async function getPendingNotificationSummaryAction(): Promise<{
  salesPersons: Array<{
    id: string;
    name: string;
    email: string;
    assignedCount: number; // 新接手的线索数（净效果）
    unassignedCount: number; // 被转走的线索数（净效果）
  }>;
}> {
  const auth = await getCrmAuth();
  if (!auth) return { salesPersons: [] };

  const notifications = await getPendingNotifications(auth);
  const { netAssigned, netUnassigned, personInfo } = aggregateNotificationsByNetEffect(notifications);

  const personIds = new Set([...netAssigned.keys(), ...netUnassigned.keys()]);
  const salesPersons = Array.from(personIds)
    .map((id) => {
      const info = personInfo.get(id) ?? { name: "", email: "" };
      return {
        id,
        name: info.name,
        email: info.email,
        assignedCount: netAssigned.get(id)?.length ?? 0,
        unassignedCount: netUnassigned.get(id)?.length ?? 0,
      };
    })
    .filter((sp) => sp.email);

  return { salesPersons };
}

/** 发送待通知邮件（给选中的销售人员；按净效果去重，循环转手只通知最终结果） */
export async function sendPendingNotificationsAction(
  salesPersonIds: string[]
): Promise<{
  success: string[];
  failed: Array<{ id: string; name: string; error: string }>;
}> {
  const auth = await getCrmAuth();
  if (!auth) return { success: [], failed: [] };

  const notifications = await getPendingNotifications(auth);
  const { netAssigned, netUnassigned, personInfo } = aggregateNotificationsByNetEffect(notifications);

  // 为每人收集其涉及的 notificationIds（用于发送后标记已读）
  const notificationIdsByPerson = new Map<string, string[]>();
  notifications.forEach((notif: NotificationWithLead) => {
    for (const pid of [notif.oldSalesPersonId, notif.newSalesPersonId]) {
      if (pid && salesPersonIds.includes(pid)) {
        if (!notificationIdsByPerson.has(pid)) notificationIdsByPerson.set(pid, []);
        notificationIdsByPerson.get(pid)!.push(notif.id);
      }
    }
  });

  const success: string[] = [];
  const failed: Array<{ id: string; name: string; error: string }> = [];
  const sentNotificationIds = new Set<string>();

  for (const salesPersonId of salesPersonIds) {
    const assignedLeads = netAssigned.get(salesPersonId) ?? [];
    const unassignedLeads = netUnassigned.get(salesPersonId) ?? [];
    if (assignedLeads.length === 0 && unassignedLeads.length === 0) continue;

    const info = personInfo.get(salesPersonId);
    const name = info?.name ?? "";
    const email = info?.email ?? "";
    if (!email) {
      failed.push({ id: salesPersonId, name, error: "邮箱为空" });
      continue;
    }

    const result = await sendLeadAssignmentNotification(
      email,
      name,
      assignedLeads,
      unassignedLeads
    );

    if (result.success) {
      success.push(salesPersonId);
      for (const id of notificationIdsByPerson.get(salesPersonId) ?? []) {
        sentNotificationIds.add(id);
      }
    } else {
      failed.push({
        id: salesPersonId,
        name,
        error: result.error || "未知错误",
      });
    }
  }

  // 本批所有通知统一标记为已发送，避免循环转手（净效果为 0）的记录一直留在待通知列表
  const allIds = notifications.map((n) => n.id);
  if (allIds.length > 0) await markNotificationsAsSent(allIds);

  return { success, failed };
}

/** 通知中心：获取当前用户相关的指派/转派简讯（供顶部栏展示） */
export async function getNotificationsForCurrentUserAction() {
  const auth = await getCrmAuth();
  return getNotificationsForUser(auth, 50);
}

/** 通知中心：查看后标记当前用户的未读通知为已读（红点/数字消失） */
export async function markMyNotificationsAsReadAction() {
  const auth = await getCrmAuth();
  if (!auth) return;
  const list = await getPendingNotifications(auth);
  const ids = list.map((n) => n.id);
  if (ids.length > 0) await markNotificationsAsSent(ids);
}

/** 全局搜索：线索、商机、客户、待签约、本月计划、跟进（分栏，每表单独分页，每页 5 条） */
export async function globalSearchCrmAction(
  keyword: string,
  leadPage: number,
  oppPage: number,
  customerPage: number,
  pendingCustomerPage: number,
  monthlyPlanPage: number,
  followUpPage: number
) {
  const auth = await getCrmAuth();
  return globalSearchCrm(
    auth,
    keyword,
    leadPage,
    oppPage,
    customerPage,
    pendingCustomerPage,
    monthlyPlanPage,
    followUpPage
  );
}
