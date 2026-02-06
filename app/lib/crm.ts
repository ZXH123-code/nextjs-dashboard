/**
 * CRM 数据层：线索、商机、客户、跟进记录
 * 状态流转：线索(有意向)→商机 → 商机(待签约/已赢单)→客户
 * 权限：admin 看全部，sales 只看 salesPersonId = 自己的记录
 */

import { auth } from "@/auth";
import { prisma } from "./prisma";

/** 获取当前用户的 CRM 权限上下文，供数据层过滤使用（role 从数据库读取，确保与 DB 同步） */
export async function getCrmAuth(): Promise<CrmAuth> {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return null;
  let role = "sales";
  try {
    const roleResult = await prisma.$queryRaw<{ role: string | null }[]>`
      SELECT role FROM users WHERE id::text = ${userId}
    `;
    role = roleResult[0]?.role ?? "sales";
  } catch {
    role = (session?.user as { role?: string })?.role ?? "sales";
  }
  return { userId, role };
}

/** 获取所有已注册用户（供表单人员选择） */
export async function getUsers() {
  return prisma.users.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// ============ 常量（从独立文件导入，便于客户端组件使用） ============
export { LEAD_STATUS, OPPORTUNITY_STATUS, CUSTOMER_STATUS } from "./crm-constants";

export type CrmAuth = { userId: string; role: string } | null;

function salesFilter(userId: string) {
  return { salesPersonId: userId };
}

/** 未登录时返回空数据（理论上 middleware 会拦截，此处兜底） */
const emptyWhere = { id: "00000000-0000-0000-0000-000000000000" }; // 不可能存在的 id

// ============ 驾驶舱统计 ============
export async function getCrmCounts(auth: CrmAuth) {
  const base =
    !auth ? emptyWhere : auth.role === "admin" ? {} : salesFilter(auth.userId);
  const [leadCount, opportunityCount, customerCount] = await Promise.all([
    prisma.crm_lead.count({ where: base }),
    prisma.crm_opportunity.count({ where: base }),
    prisma.crm_customer.count({ where: base }),
  ]);
  return { leadCount, opportunityCount, customerCount };
}

// ============ 线索 ============
export async function getLeads(auth: CrmAuth) {
  const where = !auth ? emptyWhere : auth.role === "admin" ? {} : salesFilter(auth.userId);
  return prisma.crm_lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      salesPerson: { select: { id: true, name: true } },
      opportunity: {
        select: { id: true, name: true, customer: { select: { id: true } } },
      },
    },
  });
}

export async function getLeadById(id: string, auth: CrmAuth) {
  if (!auth) return null;
  const where = auth.role === "admin" ? { id } : { id, ...salesFilter(auth.userId) };
  return prisma.crm_lead.findFirst({
    where,
    include: {
      salesPerson: { select: { id: true, name: true } },
      opportunity: { select: { id: true, name: true } },
    },
  });
}

export async function createLead(data: {
  customerName: string;
  nickname?: string;
  city?: string;
  address?: string;
  industry?: string;
  leadSource?: string;
  customerTier?: string;
  salesPersonId?: string;
  status?: string;
}) {
  return prisma.crm_lead.create({
    data: {
      customerName: data.customerName,
      nickname: data.nickname,
      city: data.city,
      address: data.address,
      industry: data.industry,
      leadSource: data.leadSource,
      customerTier: data.customerTier,
      salesPersonId: data.salesPersonId,
      status: data.status ?? "未跟进",
    },
  });
}

export async function updateLeadStatus(id: string, status: string) {
  return prisma.crm_lead.update({
    where: { id },
    data: { status },
  });
}

export async function updateLeadSalesPerson(id: string, salesPersonId: string | null) {
  return prisma.crm_lead.update({
    where: { id },
    data: { salesPersonId },
  });
}

/** 批量更新线索的销售人员 */
export async function updateLeadSalesPersonBatch(
  leadIds: string[],
  salesPersonId: string | null
) {
  if (leadIds.length === 0) return;
  await prisma.crm_lead.updateMany({
    where: { id: { in: leadIds } },
    data: { salesPersonId },
  });
}

export async function updateLead(
  id: string,
  data: {
    customerName?: string;
    nickname?: string;
    city?: string;
    address?: string;
    industry?: string;
    leadSource?: string;
    customerTier?: string;
    salesPersonId?: string | null;
    status?: string;
  }
) {
  return prisma.crm_lead.update({
    where: { id },
    data: {
      ...(data.customerName != null && { customerName: data.customerName }),
      ...(data.nickname !== undefined && { nickname: data.nickname }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.industry !== undefined && { industry: data.industry }),
      ...(data.leadSource !== undefined && { leadSource: data.leadSource }),
      ...(data.customerTier !== undefined && { customerTier: data.customerTier }),
      ...(data.salesPersonId !== undefined && { salesPersonId: data.salesPersonId }),
      ...(data.status != null && { status: data.status }),
    },
  });
}

export async function deleteLead(id: string) {
  return prisma.crm_lead.delete({ where: { id } });
}

/** 管理员强制删除线索：级联删除关联的商机、客户，并解除跟进记录关联 */
export async function deleteLeadWithCascade(leadId: string) {
  const lead = await prisma.crm_lead.findUnique({
    where: { id: leadId },
    include: { opportunity: { include: { customer: true } } },
  });
  if (!lead) return;

  const opportunity = lead.opportunity;
  const customer = opportunity?.customer ?? null;

  await prisma.$transaction(async (tx) => {
    if (customer) {
      await tx.crm_follow_up.updateMany({
        where: { customerId: customer.id },
        data: { customerId: null },
      });
      await tx.crm_customer.delete({ where: { id: customer.id } });
    }
    if (opportunity) {
      await tx.crm_follow_up.updateMany({
        where: { opportunityId: opportunity.id },
        data: { opportunityId: null },
      });
      await tx.crm_opportunity.delete({ where: { id: opportunity.id } });
    }
    await tx.crm_follow_up.updateMany({
      where: { leadId },
      data: { leadId: null },
    });
    await tx.crm_lead.delete({ where: { id: leadId } });
  });
}

// ============ 商机 ============
export async function getOpportunities(auth: CrmAuth) {
  const where = !auth ? emptyWhere : auth.role === "admin" ? {} : salesFilter(auth.userId);
  return prisma.crm_opportunity.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      lead: { select: { id: true, customerName: true } },
      salesPerson: { select: { id: true, name: true } },
      deliveryPerson: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
    },
  });
}

export async function createOpportunity(data: {
  name: string;
  leadId?: string;
  productType?: string;
  status?: string;
  amount?: number;
  expectedCloseDate?: Date;
  salesPersonId?: string;
  deliveryPersonId?: string;
}) {
  return prisma.crm_opportunity.create({
    data: {
      name: data.name,
      leadId: data.leadId,
      productType: data.productType,
      status: data.status ?? "初步沟通",
      amount: data.amount,
      expectedCloseDate: data.expectedCloseDate,
      salesPersonId: data.salesPersonId,
      deliveryPersonId: data.deliveryPersonId,
    },
  });
}

export async function updateOpportunity(
  id: string,
  data: {
    name?: string;
    productType?: string;
    status?: string;
    amount?: number;
    expectedCloseDate?: Date;
    salesPersonId?: string;
    deliveryPersonId?: string;
    lostReason?: string;
  }
) {
  return prisma.crm_opportunity.update({
    where: { id },
    data: {
      name: data.name,
      productType: data.productType,
      status: data.status,
      amount: data.amount,
      expectedCloseDate: data.expectedCloseDate,
      salesPersonId: data.salesPersonId,
      deliveryPersonId: data.deliveryPersonId,
      lostReason: data.lostReason,
    },
  });
}

export async function updateOpportunityStatus(id: string, status: string, lostReason?: string) {
  return prisma.crm_opportunity.update({
    where: { id },
    data: { status, lostReason },
  });
}

// ============ 客户 ============
export async function getCustomers(auth: CrmAuth) {
  const where = !auth ? emptyWhere : auth.role === "admin" ? {} : salesFilter(auth.userId);
  return prisma.crm_customer.findMany({
    where,
    orderBy: { firstMaintenanceDate: "desc" },
    include: {
      opportunity: { select: { id: true, name: true } },
      salesPerson: { select: { id: true, name: true } },
    },
  });
}

export async function createCustomer(data: {
  name: string;
  nickname?: string;
  city?: string;
  customerTier?: string;
  opportunityId?: string;
  salesPersonId?: string;
  industry?: string;
  employeeCount?: string;
  tags?: string;
  mainProducts?: string;
  status?: string;
}) {
  return prisma.crm_customer.create({
    data: {
      name: data.name,
      nickname: data.nickname,
      city: data.city,
      customerTier: data.customerTier,
      opportunityId: data.opportunityId,
      salesPersonId: data.salesPersonId,
      industry: data.industry,
      employeeCount: data.employeeCount,
      tags: data.tags,
      mainProducts: data.mainProducts,
      status: data.status ?? "已签约",
    },
  });
}

export async function updateCustomer(
  id: string,
  data: {
    name?: string;
    nickname?: string;
    city?: string;
    customerTier?: string;
    industry?: string;
    firstMaintenanceDate?: Date | null;
    employeeCount?: string;
    tags?: string;
    mainProducts?: string;
  }
) {
  return prisma.crm_customer.update({
    where: { id },
    data: {
      name: data.name,
      nickname: data.nickname,
      city: data.city,
      customerTier: data.customerTier,
      industry: data.industry,
      firstMaintenanceDate: data.firstMaintenanceDate,
      employeeCount: data.employeeCount,
      tags: data.tags,
      mainProducts: data.mainProducts,
    },
  });
}

// ============ 跟进记录 ============
/** 跟进记录列表。无 filters 时：admin 看全部，sales 仅看自己跟进或自己负责的线索/商机/客户的记录 */
export async function getFollowUps(
  auth: CrmAuth,
  filters?: { leadId?: string; customerId?: string; opportunityId?: string }
) {
  let where: Record<string, unknown> = filters ?? {};
  if (!auth) {
    where = { ...where, id: "00000000-0000-0000-0000-000000000000" };
  } else if (auth.role === "sales" && auth.userId) {
    // 销售人员：只看自己跟进的，或关联的线索/客户/商机是自己负责的
    where = {
      ...where,
      OR: [
        { followUpById: auth.userId },
        { lead: { salesPersonId: auth.userId } },
        { customer: { salesPersonId: auth.userId } },
        { opportunity: { salesPersonId: auth.userId } },
      ],
    };
  }
  return prisma.crm_follow_up.findMany({
    where,
    orderBy: { followDate: "desc" },
    include: {
      followUpBy: { select: { id: true, name: true } },
      lead: { select: { id: true, customerName: true } },
      customer: { select: { id: true, name: true } },
      opportunity: { select: { id: true, name: true } },
    },
  });
}

export async function createFollowUp(data: {
  content: string;
  followUpById: string;
  followDate: Date;
  leadId?: string;
  customerId?: string;
  opportunityId?: string;
  contactPerson?: string;
  summary?: string;
  nextStep?: string;
  customerNeeds?: string;
  status?: string;
  isSystemGenerated?: boolean; // 是否为系统自动生成（状态变更时）
}) {
  return prisma.crm_follow_up.create({
    data: {
      content: data.content,
      followUpById: data.followUpById,
      followDate: data.followDate,
      leadId: data.leadId,
      customerId: data.customerId,
      opportunityId: data.opportunityId,
      contactPerson: data.contactPerson,
      summary: data.summary,
      nextStep: data.nextStep,
      customerNeeds: data.customerNeeds,
      status: data.status,
      isSystemGenerated: data.isSystemGenerated ?? false,
    },
  });
}

/** 获取跟进时间线（按创建时间倒序），用于展示完整历史记录。
 * - 按 leadId：该线索的全部跟进。
 * - 按 opportunityId：该商机 + 关联线索的全部跟进（覆盖线索→商机全过程）。
 * - 按 customerId：该客户 + 来源商机 + 关联线索的全部跟进（覆盖线索→商机→客户全过程）。 */
export async function getFollowUpTimeline(
  auth: CrmAuth,
  filters: { leadId?: string; customerId?: string; opportunityId?: string }
) {
  if (!filters.leadId && !filters.customerId && !filters.opportunityId) {
    throw new Error("必须提供 leadId、customerId 或 opportunityId 之一");
  }

  let contentWhere: Record<string, unknown> = {};
  if (filters.leadId) {
    contentWhere.leadId = filters.leadId;
  } else if (filters.customerId) {
    const customer = await prisma.crm_customer.findUnique({
      where: { id: filters.customerId },
      select: { opportunityId: true, opportunity: { select: { leadId: true } } },
    });
    if (customer?.opportunityId) {
      const leadId = customer.opportunity?.leadId ?? null;
      contentWhere.OR = [
        { customerId: filters.customerId },
        { opportunityId: customer.opportunityId },
        ...(leadId ? [{ leadId }] : []),
      ];
    } else {
      contentWhere.customerId = filters.customerId;
    }
  } else if (filters.opportunityId) {
    const opp = await prisma.crm_opportunity.findUnique({
      where: { id: filters.opportunityId },
      select: { leadId: true },
    });
    if (opp?.leadId) {
      contentWhere.OR = [
        { opportunityId: filters.opportunityId },
        { leadId: opp.leadId },
      ];
    } else {
      contentWhere.opportunityId = filters.opportunityId;
    }
  }

  let where: Record<string, unknown>;
  if (!auth) {
    where = { AND: [contentWhere, { id: "00000000-0000-0000-0000-000000000000" }] };
  } else if (auth.role === "sales" && auth.userId) {
    where = {
      AND: [
        contentWhere,
        {
          OR: [
            { lead: { salesPersonId: auth.userId } },
            { customer: { salesPersonId: auth.userId } },
            { opportunity: { salesPersonId: auth.userId } },
          ],
        },
      ],
    };
  } else {
    where = contentWhere;
  }

  return prisma.crm_follow_up.findMany({
    where,
    orderBy: { createdAt: "desc" }, // 按创建时间倒序
    include: {
      followUpBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
      lead: { select: { id: true, customerName: true } },
      customer: { select: { id: true, name: true } },
      opportunity: { select: { id: true, name: true } },
    },
  });
}

/** 更新跟进记录（仅 admin 可用） */
export async function updateFollowUp(
  id: string,
  data: {
    content?: string;
    followDate?: Date;
    contactPerson?: string;
    summary?: string;
    nextStep?: string;
    customerNeeds?: string;
    status?: string;
  },
  updatedById: string
) {
  return prisma.crm_follow_up.update({
    where: { id },
    data: {
      ...(data.content !== undefined && { content: data.content }),
      ...(data.followDate !== undefined && { followDate: data.followDate }),
      ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson }),
      ...(data.summary !== undefined && { summary: data.summary }),
      ...(data.nextStep !== undefined && { nextStep: data.nextStep }),
      ...(data.customerNeeds !== undefined && { customerNeeds: data.customerNeeds }),
      ...(data.status !== undefined && { status: data.status }),
      updatedAt: new Date(),
      updatedById,
    },
  });
}

/** 删除跟进记录（仅 admin 可用） */
export async function deleteFollowUp(id: string) {
  return prisma.crm_follow_up.delete({ where: { id } });
}

// ============ 状态流转（核心逻辑） ============

/** 线索转商机：当状态变为「有意向」时调用 */
export async function leadToOpportunity(leadId: string) {
  const lead = await prisma.crm_lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("线索不存在");
  if (lead.status !== "有意向") throw new Error("仅当线索状态为「有意向」时可转入商机");

  const existing = await prisma.crm_opportunity.findUnique({ where: { leadId } });
  if (existing) throw new Error("该线索已转入商机");

  const opportunity = await prisma.crm_opportunity.create({
    data: {
      name: lead.customerName,
      leadId: lead.id,
      productType: null,
      status: "初步沟通",
      salesPersonId: lead.salesPersonId,
    },
  });

  return opportunity;
}

/** 商机转客户：当状态变为「待签约」或「已赢单」时调用，继承来源线索的字段 */
export async function opportunityToCustomer(opportunityId: string) {
  const opp = await prisma.crm_opportunity.findUnique({
    where: { id: opportunityId },
    include: { customer: true, lead: true },
  });
  if (!opp) throw new Error("商机不存在");
  if (!["待签约", "已赢单"].includes(opp.status)) {
    throw new Error("仅当商机状态为「待签约」或「已赢单」时可转入客户");
  }
  if (opp.customer) throw new Error("该商机已转入客户");

  const lead = opp.lead;
  const customer = await prisma.crm_customer.create({
    data: {
      name: lead?.customerName ?? opp.name,
      nickname: lead?.nickname ?? null,
      city: lead?.city ?? null,
      customerTier: lead?.customerTier ?? null,
      industry: lead?.industry ?? null,
      opportunityId: opp.id,
      salesPersonId: opp.salesPersonId,
      status: opp.status === "已赢单" ? "已签约" : "预备签约",
    },
  });

  return customer;
}

// ============ 线索销售人员变更通知 ============

/** 记录线索销售人员变更（用于后续发送邮件通知） */
export async function recordLeadAssignmentChange(data: {
  leadId: string;
  oldSalesPersonId: string | null;
  newSalesPersonId: string | null;
  createdBy: string;
}) {
  const { leadId, oldSalesPersonId, newSalesPersonId, createdBy } = data;

  // 确定变更类型
  let changeType: string;
  if (!oldSalesPersonId && newSalesPersonId) {
    changeType = "assigned"; // 从无到有
  } else if (oldSalesPersonId && !newSalesPersonId) {
    changeType = "unassigned"; // 从有到无
  } else if (oldSalesPersonId && newSalesPersonId) {
    changeType = "reassigned"; // 从A到B
  } else {
    return null; // 无变更，不记录
  }

  return prisma.crm_lead_assignment_notification.create({
    data: {
      leadId,
      changeType,
      oldSalesPersonId,
      newSalesPersonId,
      createdBy,
    },
  });
}

/** 批量记录线索销售人员变更 */
export async function recordLeadAssignmentChanges(
  leadChanges: Array<{
    leadId: string;
    oldSalesPersonId: string | null;
    newSalesPersonId: string | null;
  }>,
  createdBy: string
) {
  const records = leadChanges
    .map((change) => {
      let changeType: string;
      if (!change.oldSalesPersonId && change.newSalesPersonId) {
        changeType = "assigned";
      } else if (change.oldSalesPersonId && !change.newSalesPersonId) {
        changeType = "unassigned";
      } else if (change.oldSalesPersonId && change.newSalesPersonId) {
        changeType = "reassigned";
      } else {
        return null; // 无变更
      }
      return {
        leadId: change.leadId,
        changeType,
        oldSalesPersonId: change.oldSalesPersonId,
        newSalesPersonId: change.newSalesPersonId,
        createdBy,
      };
    })
    .filter((r) => r !== null);

  if (records.length === 0) return;

  await prisma.crm_lead_assignment_notification.createMany({
    data: records,
  });
}

/** 获取待通知的变更记录（按销售人员分组） */
export async function getPendingNotifications(auth: CrmAuth) {
  if (!auth) return [];

  // 查询未通知的记录
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

  return prisma.crm_lead_assignment_notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      lead: { select: { id: true, customerName: true } },
      oldSalesPerson: { select: { id: true, name: true, email: true } },
      newSalesPerson: { select: { id: true, name: true, email: true } },
    },
  });
}

/** 标记通知为已发送 */
export async function markNotificationsAsSent(notificationIds: string[]) {
  if (notificationIds.length === 0) return;
  await prisma.crm_lead_assignment_notification.updateMany({
    where: { id: { in: notificationIds } },
    data: { notified: true, notifiedAt: new Date() },
  });
}
