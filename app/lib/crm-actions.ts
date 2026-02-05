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
  updateLead,
  updateLeadStatus,
  updateLeadSalesPerson,
  updateLeadSalesPersonBatch,
  deleteLead,
  updateOpportunityStatus,
  opportunityToCustomer,
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
}

// 更新线索状态（改为「有意向」后，需到新建商机页选择该线索并完善商机信息）
export async function updateLeadStatusAction(leadId: string, status: string) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (!userId) return;
  const lead = await prisma.crm_lead.findUnique({ where: { id: leadId }, select: { salesPersonId: true } });
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

// 编辑线索（仅 admin）
export async function updateLeadAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (role !== "admin") return { error: "无权限" };

  const leadId = formData.get("leadId") as string;
  if (!leadId) return { error: "缺少线索ID" };

  const customerName = formData.get("customerName") as string;
  if (!customerName?.trim()) return { error: "客户名称必填" };

  await updateLead(leadId, {
    customerName: customerName.trim(),
    nickname: (formData.get("nickname") as string) || undefined,
    city: (formData.get("city") as string) || undefined,
    address: (formData.get("address") as string) || undefined,
    industry: (formData.get("industry") as string) || undefined,
    leadSource: (formData.get("leadSource") as string) || undefined,
    customerTier: (formData.get("customerTier") as string) || undefined,
    salesPersonId: (formData.get("salesPersonId") as string) || null,
    status: (formData.get("status") as string) || undefined,
  });
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
  redirect("/dashboard/crm/leads");
}

// 删除线索（仅 admin）
export async function deleteLeadAction(formData: FormData) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (role !== "admin") return;

  const leadId = formData.get("leadId") as string;
  if (!leadId) return;

  const lead = await prisma.crm_lead.findUnique({
    where: { id: leadId },
    include: { opportunity: true },
  });

  // 若已有关联商机，则强制删除线索，但保留商机，仅断开关联
  if (lead?.opportunity) {
    await prisma.crm_opportunity.update({
      where: { id: lead.opportunity.id },
      data: { leadId: null },
    });
  }

  await deleteLead(leadId);
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard");
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
  const lead = await prisma.crm_lead.findUnique({ where: { id: leadId }, select: { salesPersonId: true } });
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
        where: { id: { in: leadIds } },
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

// 创建商机（若有关联线索可自动带出销售人员，否则用当前用户）
export async function createOpportunityAction(formData: FormData) {
  const name = formData.get("name") as string;
  const leadId = (formData.get("leadId") as string) || undefined;
  if (!name?.trim()) return { error: "商机名称必填" };
  const session = await auth();
  const currentUserId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";

  let salesPersonId: string | undefined;
  if (role === "sales") {
    // 销售人员只能创建给自己，忽略表单值
    salesPersonId = currentUserId;
  } else {
    salesPersonId = (formData.get("salesPersonId") as string) || undefined;
    if (leadId && !salesPersonId) {
      const lead = await prisma.crm_lead.findUnique({
        where: { id: leadId },
        select: { salesPersonId: true },
      });
      salesPersonId = lead?.salesPersonId ?? undefined;
    }
    if (!salesPersonId) {
      salesPersonId = currentUserId;
    }
  }

  await createOpportunity({
    name: name.trim(),
    leadId,
    productType: (formData.get("productType") as string) || undefined,
    status: (formData.get("status") as string) || "初步沟通",
    amount: formData.get("amount") ? Number(formData.get("amount")) : undefined,
    salesPersonId,
  });
  revalidatePath("/dashboard/crm/opportunities");
  revalidatePath("/dashboard");
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
    salesPersonId,
  });
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard");
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
    customerId: (formData.get("customerId") as string) || undefined,
    opportunityId: (formData.get("opportunityId") as string) || undefined,
    contactPerson: (formData.get("contactPerson") as string) || undefined,
    summary: (formData.get("summary") as string) || undefined,
    nextStep: (formData.get("nextStep") as string) || undefined,
    customerNeeds: (formData.get("customerNeeds") as string) || undefined,
  });
  revalidatePath("/dashboard/crm/follow-ups");
  revalidatePath("/dashboard/crm/customers");
  revalidatePath("/dashboard/crm/opportunities");
  redirect("/dashboard/crm/follow-ups");
}
