/**
 * CRM 数据层：线索、商机、客户、跟进记录
 * 状态流转：线索(有意向)→商机 → 商机(待签约/已赢单)→客户
 * 权限：admin 看全部，sales 只看「自己在负责人列表」的记录
 */

import { auth } from "@/auth";
import { del } from "@vercel/blob";
import { Prisma } from "@prisma/client";
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

function leadAssigneeFilter(userId: string): Prisma.crm_leadWhereInput {
  return { assignees: { some: { userId } } };
}

/** 未登录时返回空数据（理论上 middleware 会拦截，此处兜底） */
const emptyWhere = { id: "00000000-0000-0000-0000-000000000000" }; // 不可能存在的 id

/**
 * 构建线索查询条件（统一处理权限和软删除）
 * @param auth 权限上下文
 * @param includeDeleted 是否包含已删除的记录（默认 false，仅管理员恢复时使用）
 */
function buildLeadWhere(auth: CrmAuth, includeDeleted = false) {
  const base = !auth ? emptyWhere : auth.role === "admin" ? {} : leadAssigneeFilter(auth.userId);

  // 软删除过滤：默认只查询未删除的记录
  const deletedFilter = includeDeleted ? {} : { deletedAt: null };

  return { ...base, ...deletedFilter };
}

// ============ 驾驶舱统计 ============
export async function getCrmCounts(auth: CrmAuth) {
  const leadWhere = buildLeadWhere(auth);
  const base =
    !auth ? emptyWhere : auth.role === "admin" ? {} : salesFilter(auth.userId);
  const [leadCount, opportunityCount, customerCount] = await Promise.all([
    prisma.crm_lead.count({ where: leadWhere }),
    prisma.crm_opportunity.count({ where: base }),
    prisma.crm_customer.count({ where: base }),
  ]);
  return { leadCount, opportunityCount, customerCount };
}

// ============ 线索 ============
/** 筛选条件（与 FilterDialog 结构一致，用于 URL 序列化后传入服务端） */
export type LeadFilterCondition = {
  id: string;
  field: string;
  operator: string;
  value: string | string[];
};

export type LeadFilterGroup = {
  id: string;
  conditions: LeadFilterCondition[];
};

export type LeadFilter = { groups: LeadFilterGroup[] };

export type GetLeadsOptions = {
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
  /** 筛选条件，来自 URL 解码 */
  filter?: LeadFilter;
};

/** 将单个筛选条件转换为 Prisma where 子句 */
function conditionToPrisma(
  c: LeadFilterCondition
): Prisma.crm_leadWhereInput {
  const { field, operator, value } = c;
  const val = Array.isArray(value) ? value[0] : value;
  const valStr = String(val ?? "");

  const textFields = [
    "customerName", "contactPerson", "nickname", "city", "address",
    "industry", "leadSource", "contactPhone", "customerTier", "status", "remark", "importSource",
  ];
  const boolFields = ["isKeyFocus", "keyFocusByAdmin"];
  const dateFields = ["createdAt"];

  const isText = textFields.includes(field) || field === "salesPerson.name" || field === "assignees.name";
  const isBool = boolFields.includes(field);
  const isDate = dateFields.includes(field);

  const eqVal = isBool ? valStr === "true" : valStr;
  const dateVal = valStr ? new Date(valStr) : null;

  switch (operator) {
    case "equals":
      if (field === "salesPerson.name" || field === "assignees.name") {
        return {
          assignees: { some: { user: { name: { equals: valStr, mode: "insensitive" } } } },
        } as Prisma.crm_leadWhereInput;
      }
      if (isBool) return { [field]: eqVal } as Prisma.crm_leadWhereInput;
      if (isDate && dateVal) {
        const nextDay = new Date(dateVal);
        nextDay.setDate(nextDay.getDate() + 1);
        return { [field]: { gte: dateVal, lt: nextDay } } as Prisma.crm_leadWhereInput;
      }
      return { [field]: { equals: valStr, mode: "insensitive" } } as Prisma.crm_leadWhereInput;

    case "notEquals":
      if (field === "salesPerson.name" || field === "assignees.name") {
        return {
          assignees: { some: { user: { name: { not: { equals: valStr, mode: "insensitive" } } } } },
        } as Prisma.crm_leadWhereInput;
      }
      if (isBool) return { [field]: { not: eqVal } } as Prisma.crm_leadWhereInput;
      if (isDate && dateVal) {
        const nextDay = new Date(dateVal);
        nextDay.setDate(nextDay.getDate() + 1);
        return { NOT: { [field]: { gte: dateVal, lt: nextDay } } } as Prisma.crm_leadWhereInput;
      }
      return { [field]: { not: { equals: valStr, mode: "insensitive" } } } as Prisma.crm_leadWhereInput;

    case "contains":
      if (field === "salesPerson.name" || field === "assignees.name") {
        return {
          assignees: { some: { user: { name: { contains: valStr, mode: "insensitive" } } } },
        } as Prisma.crm_leadWhereInput;
      }
      return { [field]: { contains: valStr, mode: "insensitive" } } as Prisma.crm_leadWhereInput;

    case "notContains":
      if (field === "salesPerson.name" || field === "assignees.name") {
        return {
          assignees: { some: { user: { name: { not: { contains: valStr, mode: "insensitive" } } } } },
        } as Prisma.crm_leadWhereInput;
      }
      return { [field]: { not: { contains: valStr, mode: "insensitive" } } } as Prisma.crm_leadWhereInput;

    case "startsWith":
      if (field === "salesPerson.name" || field === "assignees.name") {
        return {
          assignees: { some: { user: { name: { startsWith: valStr, mode: "insensitive" } } } },
        } as Prisma.crm_leadWhereInput;
      }
      return { [field]: { startsWith: valStr, mode: "insensitive" } } as Prisma.crm_leadWhereInput;

    case "endsWith":
      if (field === "salesPerson.name" || field === "assignees.name") {
        return {
          assignees: { some: { user: { name: { endsWith: valStr, mode: "insensitive" } } } },
        } as Prisma.crm_leadWhereInput;
      }
      return { [field]: { endsWith: valStr, mode: "insensitive" } } as Prisma.crm_leadWhereInput;

    case "isEmpty":
      if (field === "salesPerson.name" || field === "assignees.name") {
        return { assignees: { none: {} } } as Prisma.crm_leadWhereInput;
      }
      return { OR: [{ [field]: null }, { [field]: "" }] } as Prisma.crm_leadWhereInput;

    case "isNotEmpty":
      if (field === "salesPerson.name" || field === "assignees.name") {
        return { assignees: { some: {} } } as Prisma.crm_leadWhereInput;
      }
      return { AND: [{ [field]: { not: null } }, { [field]: { not: "" } }] } as Prisma.crm_leadWhereInput;

    case "greaterThan":
      if (isDate) return { [field]: { gt: dateVal } } as Prisma.crm_leadWhereInput;
      return { [field]: { gt: Number(valStr) || 0 } } as Prisma.crm_leadWhereInput;

    case "greaterThanOrEqual":
      if (isDate) return { [field]: { gte: dateVal } } as Prisma.crm_leadWhereInput;
      return { [field]: { gte: Number(valStr) || 0 } } as Prisma.crm_leadWhereInput;

    case "lessThan":
      if (isDate) return { [field]: { lt: dateVal } } as Prisma.crm_leadWhereInput;
      return { [field]: { lt: Number(valStr) || 0 } } as Prisma.crm_leadWhereInput;

    case "lessThanOrEqual":
      if (isDate) return { [field]: { lte: dateVal } } as Prisma.crm_leadWhereInput;
      return { [field]: { lte: Number(valStr) || 0 } } as Prisma.crm_leadWhereInput;

    default:
      return {};
  }
}

/** 从 URL 解码的筛选结构构建 Prisma where（组间 OR，组内 AND） */
function buildLeadWhereFromFilter(filter: LeadFilter | undefined): Prisma.crm_leadWhereInput {
  if (!filter?.groups?.length) return {};
  const validGroups = filter.groups.filter((g) => g.conditions?.length > 0);
  if (validGroups.length === 0) return {};
  return {
    OR: validGroups.map((g) => ({
      AND: g.conditions.map((c) => conditionToPrisma(c)),
    })),
  };
}

/** getLeads 返回的线索项类型（含 salesPerson、opportunity） */
export type LeadListItem = Prisma.crm_leadGetPayload<{
  include: {
    assignees: {
      orderBy: { createdAt: "asc" };
      include: { user: { select: { id: true; name: true } } };
    };
    opportunity: {
      select: { id: true; name: true; customer: { select: { id: true; status: true } } };
    };
  };
}>;

export async function getLeads(
  auth: CrmAuth,
  options: GetLeadsOptions = {}
): Promise<{ items: LeadListItem[]; total: number }> {
  const { includeDeleted = false, page, pageSize, filter } = options;
  const baseWhere = buildLeadWhere(auth, includeDeleted);
  const filterWhere = buildLeadWhereFromFilter(filter);
  const where: Prisma.crm_leadWhereInput = {
    ...baseWhere,
    ...filterWhere,
  };
  const orderBy = [{ isKeyFocus: "desc" as const }, { createdAt: "desc" as const }];
  const include = {
    assignees: { orderBy: { createdAt: "asc" as const }, include: { user: { select: { id: true, name: true } } } },
    opportunity: {
      select: { id: true, name: true, customer: { select: { id: true, status: true } } },
    },
  };

  if (page != null && pageSize != null && page >= 1 && pageSize >= 1) {
    const [items, total] = await Promise.all([
      prisma.crm_lead.findMany({
        where,
        orderBy,
        include,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.crm_lead.count({ where }),
    ]);
    return { items: items as LeadListItem[], total };
  }
  const items = await prisma.crm_lead.findMany({ where, orderBy, include });
  return { items: items as LeadListItem[], total: items.length };
}

/** 计算新建线索会出现在第几页（新线索在重点关注之后、按 createdAt 最新，故位置 = 重点关注数量 + 1） */
export async function getPageForNewLead(
  auth: CrmAuth,
  filter: LeadFilter | undefined,
  pageSize: number
): Promise<number> {
  const baseWhere = buildLeadWhere(auth, false);
  const filterWhere = buildLeadWhereFromFilter(filter);
  const where: Prisma.crm_leadWhereInput = {
    ...baseWhere,
    ...filterWhere,
    isKeyFocus: true,
  };
  const keyFocusCount = await prisma.crm_lead.count({ where });
  return Math.max(1, Math.ceil((keyFocusCount + 1) / pageSize));
}

/** 计算某条线索在当前筛选与排序下位于第几页（用于搜索点击跳转高亮） */
export async function getPageForLeadId(
  auth: CrmAuth,
  leadId: string,
  filter: LeadFilter | undefined,
  pageSize: number
): Promise<number> {
  const baseWhere = buildLeadWhere(auth, false);
  const filterWhere = buildLeadWhereFromFilter(filter);
  const listWhere: Prisma.crm_leadWhereInput = { ...baseWhere, ...filterWhere };
  const lead = await prisma.crm_lead.findFirst({
    where: { id: leadId, ...listWhere },
    select: { isKeyFocus: true, createdAt: true },
  });
  if (!lead) return 1;
  const beforeWhere: Prisma.crm_leadWhereInput = lead.isKeyFocus
    ? { isKeyFocus: true, createdAt: { gt: lead.createdAt } }
    : { OR: [{ isKeyFocus: true }, { isKeyFocus: false, createdAt: { gt: lead.createdAt } }] };
  const beforeCount = await prisma.crm_lead.count({
    where: { ...listWhere, ...beforeWhere },
  });
  return Math.max(1, Math.ceil((beforeCount + 1) / pageSize));
}

const MAX_LEAD_IDS_FOR_SELECT_ALL = 5000;

/** 按当前筛选条件返回线索 id 列表（用于「全选」），最多返回 MAX_LEAD_IDS_FOR_SELECT_ALL 条 */
export async function getLeadIds(
  auth: CrmAuth,
  filter: LeadFilter | undefined,
  limit = MAX_LEAD_IDS_FOR_SELECT_ALL
): Promise<{ ids: string[]; total: number }> {
  const baseWhere = buildLeadWhere(auth, false);
  const filterWhere = buildLeadWhereFromFilter(filter);
  const where: Prisma.crm_leadWhereInput = { ...baseWhere, ...filterWhere };
  const [ids, total] = await Promise.all([
    prisma.crm_lead.findMany({
      where,
      orderBy: [{ isKeyFocus: "desc" as const }, { createdAt: "desc" as const }],
      select: { id: true },
      take: limit,
    }),
    prisma.crm_lead.count({ where }),
  ]);
  return { ids: ids.map((r) => r.id), total };
}

/**
 * 获取已删除的线索（仅管理员）
 */
export async function getDeletedLeads(auth: CrmAuth) {
  if (!auth || auth.role !== "admin") return [];

  return prisma.crm_lead.findMany({
    where: {
      deletedAt: { not: null }, // 只查询已删除的记录
    },
    orderBy: { deletedAt: "desc" }, // 按删除时间倒序
    include: {
      assignees: { orderBy: { createdAt: "asc" as const }, include: { user: { select: { id: true, name: true } } } },
      opportunity: {
        select: { id: true, name: true, status: true },
      },
    },
  });
}

export async function getLeadById(id: string, auth: CrmAuth, includeDeleted = false) {
  if (!auth) return null;
  const baseWhere = auth.role === "admin" ? { id } : { id, ...leadAssigneeFilter(auth.userId) };
  const deletedFilter = includeDeleted ? {} : { deletedAt: null };
  const where = { ...baseWhere, ...deletedFilter };
  return prisma.crm_lead.findFirst({
    where,
    include: {
      assignees: { orderBy: { createdAt: "asc" as const }, include: { user: { select: { id: true, name: true } } } },
      opportunity: { select: { id: true, name: true } },
    },
  });
}

export async function createLead(data: {
  customerName: string;
  nickname?: string;
  contactPerson?: string;
  contactEmail?: string;
  city?: string;
  address?: string;
  industry?: string;
  leadSource?: string;
  customerTier?: string;
  contactPhone?: string;
  remark?: string;
  assigneeIds?: string[];
  status?: string;
}) {
  const assigneeIds = (data.assigneeIds ?? []).filter(Boolean);
  return prisma.crm_lead.create({
    data: {
      customerName: data.customerName,
      nickname: data.nickname,
      contactPerson: data.contactPerson,
      contactEmail: data.contactEmail,
      city: data.city,
      address: data.address,
      industry: data.industry,
      leadSource: data.leadSource,
      customerTier: data.customerTier,
      contactPhone: data.contactPhone,
      remark: data.remark,
      status: data.status ?? "未跟进",
      ...(assigneeIds.length > 0 && {
        assignees: { create: assigneeIds.map((userId) => ({ userId })) },
      }),
    },
  });
}

export async function updateLeadStatus(id: string, status: string) {
  // 注意：这里不检查 deletedAt，因为可能需要在恢复时更新状态
  // 调用方应该确保只更新未删除的记录
  return prisma.crm_lead.update({
    where: { id },
    data: { status },
  });
}

/** 设置线索负责人列表（全量覆盖） */
export async function setLeadAssignees(leadId: string, userIds: string[]) {
  const ids = Array.from(new Set((userIds ?? []).filter(Boolean)));
  await prisma.$transaction(async (tx) => {
    await tx.crm_lead_assignee.deleteMany({ where: { leadId } });
    if (ids.length > 0) {
      await tx.crm_lead_assignee.createMany({
        data: ids.map((userId) => ({ leadId, userId })),
        skipDuplicates: true,
      });
    }
  });
}

/** 批量给多条线索「追加」同一个负责人（不影响已有负责人） */
export async function addLeadAssigneeBatch(leadIds: string[], userId: string) {
  if (!leadIds?.length || !userId) return;
  await prisma.crm_lead_assignee.createMany({
    data: leadIds.map((leadId) => ({ leadId, userId })),
    skipDuplicates: true,
  });
}

export async function updateLead(
  id: string,
  data: {
    customerName?: string;
    nickname?: string;
    contactPerson?: string;
    contactEmail?: string;
    city?: string;
    address?: string;
    industry?: string;
    leadSource?: string;
    customerTier?: string;
    contactPhone?: string;
    remark?: string;
    status?: string;
    isKeyFocus?: boolean;
  }
) {
  const updated = await prisma.crm_lead.update({
    where: { id },
    data: {
      ...(data.customerName != null && { customerName: data.customerName }),
      ...(data.nickname !== undefined && { nickname: data.nickname }),
      ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson }),
      ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.industry !== undefined && { industry: data.industry }),
      ...(data.leadSource !== undefined && { leadSource: data.leadSource }),
      ...(data.customerTier !== undefined && { customerTier: data.customerTier }),
      ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
      ...(data.remark !== undefined && { remark: data.remark }),
      ...(data.status != null && { status: data.status }),
      ...(data.isKeyFocus !== undefined && { isKeyFocus: data.isKeyFocus }),
    },
  });
  // 统一保证：只要状态被改为「有意向」，必有商机（编辑页、表单等任意入口）
  if (data.status === "有意向") {
    await ensureLeadHasOpportunityIfIntent(id);
  }
  return updated;
}

/**
 * 设置线索为重点关注，并同步到其派生的商机、客户
 * @param byAdmin true=管理员操作（蓝星、sales 不可取消），false=sales 自助（琥珀星、可取消）；sales 无法修改 keyFocusByAdmin 为 true 的线索
 */
export async function setLeadKeyFocus(leadId: string, isKeyFocus: boolean, byAdmin: boolean) {
  const lead = await prisma.crm_lead.findUnique({
    where: { id: leadId, deletedAt: null },
    select: {
      keyFocusByAdmin: true,
      opportunity: { select: { id: true, customer: { select: { id: true } } } },
    },
  });
  if (!lead) return;
  const leadRow = lead as { keyFocusByAdmin?: boolean };
  if (!byAdmin && leadRow.keyFocusByAdmin) return; // sales 不可取消管理员标的重点

  const keyFocusByAdmin = byAdmin ? isKeyFocus : !!leadRow.keyFocusByAdmin;

  await prisma.$transaction(async (tx) => {
    await tx.crm_lead.update({
      where: { id: leadId },
      data: { isKeyFocus, keyFocusByAdmin },
    });
    if (lead.opportunity) {
      await tx.crm_opportunity.update({
        where: { id: lead.opportunity.id },
        data: { isKeyFocus, keyFocusByAdmin },
      });
      if (lead.opportunity.customer) {
        await tx.crm_customer.update({
          where: { id: lead.opportunity.customer.id },
          data: { isKeyFocus, keyFocusByAdmin },
        });
      }
    }
  });
}

/**
 * 软删除线索（推荐）：设置 deletedAt 时间戳，可恢复
 */
export async function softDeleteLead(id: string) {
  return prisma.crm_lead.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

/**
 * 恢复已删除的线索
 */
export async function restoreLead(id: string) {
  return prisma.crm_lead.update({
    where: { id },
    data: { deletedAt: null },
  });
}

/**
 * 物理删除线索（谨慎使用，仅用于彻底清理）
 */
export async function deleteLead(id: string) {
  return prisma.crm_lead.delete({ where: { id } });
}

/**
 * 管理员强制删除线索：级联删除关联的商机、客户，并解除跟进记录关联。
 * 按 id 查询（不限制 deletedAt），以便同时支持：
 * - 回收站内「彻底删除」已软删除的线索；
 * - 批量「清理 N 天前已删除线索」时物理删除已软删除的记录。
 */
export async function deleteLeadWithCascade(leadId: string) {
  const lead = await prisma.crm_lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      opportunity: {
        select: {
          id: true,
          customer: {
            select: { id: true }
          }
        }
      }
    },
  });
  if (!lead) return;

  const opportunityId = lead.opportunity?.id;
  const customerId = lead.opportunity?.customer?.id;

  // 增加事务超时时间到 30 秒，并优化操作顺序
  await prisma.$transaction(
    async (tx) => {
      // 1. 先解除所有跟进记录的关联（批量操作，效率高）
      const followUpUpdates = [];
      if (customerId) {
        followUpUpdates.push(
          tx.crm_follow_up.updateMany({
            where: { customerId },
            data: { customerId: null },
          })
        );
      }
      if (opportunityId) {
        followUpUpdates.push(
          tx.crm_follow_up.updateMany({
            where: { opportunityId },
            data: { opportunityId: null },
          })
        );
      }
      followUpUpdates.push(
        tx.crm_follow_up.updateMany({
          where: { leadId },
          data: { leadId: null },
        })
      );
      // 并行执行所有更新操作
      await Promise.all(followUpUpdates);

      // 2. 删除客户（如果存在）
      if (customerId) {
        await tx.crm_customer.delete({ where: { id: customerId } });
      }

      // 3. 删除商机（如果存在）
      if (opportunityId) {
        await tx.crm_opportunity.delete({ where: { id: opportunityId } });
      }

      // 4. 最后删除线索
      await tx.crm_lead.delete({ where: { id: leadId } });
    },
    {
      maxWait: 10000, // 等待锁的最大时间：10 秒
      timeout: 30000, // 事务超时时间：30 秒
    }
  );
}

// ============ 商机 ============
export type GetOpportunitiesOptions = { page?: number; pageSize?: number; leadId?: string };

/** getOpportunities 返回的商机项类型（含 lead、customer、salesPerson、deliveryPerson，amount 为 number） */
export type OpportunityListItem = Omit<
  Prisma.crm_opportunityGetPayload<{
    include: {
      lead: { select: { id: true; customerName: true; contactPhone: true } };
      salesPerson: { select: { id: true; name: true } };
      deliveryPerson: { select: { id: true; name: true } };
      customer: { select: { id: true; name: true } };
    };
  }>,
  "amount"
> & { amount: number | null };

export async function getOpportunities(
  auth: CrmAuth,
  options: GetOpportunitiesOptions = {}
): Promise<{ items: OpportunityListItem[]; total: number }> {
  const { page, pageSize, leadId } = options;
  let where = !auth ? emptyWhere : auth.role === "admin" ? {} : salesFilter(auth.userId);
  if (leadId) {
    where = { ...where, leadId };
  }
  const orderBy = [{ isKeyFocus: "desc" as const }, { createdAt: "desc" as const }];
  const include = {
    lead: { select: { id: true, customerName: true, contactPhone: true } },
    salesPerson: { select: { id: true, name: true } },
    deliveryPerson: { select: { id: true, name: true } },
    customer: { select: { id: true, name: true } },
  };

  const mapAmount = (rows: Awaited<ReturnType<typeof prisma.crm_opportunity.findMany>>) =>
    rows.map((o) => ({ ...o, amount: o.amount != null ? Number(o.amount) : null }));

  if (page != null && pageSize != null && page >= 1 && pageSize >= 1) {
    const [rows, total] = await Promise.all([
      prisma.crm_opportunity.findMany({
        where,
        orderBy,
        include,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.crm_opportunity.count({ where }),
    ]);
    return { items: mapAmount(rows) as OpportunityListItem[], total };
  }
  const rows = await prisma.crm_opportunity.findMany({ where, orderBy, include });
  return { items: mapAmount(rows) as OpportunityListItem[], total: rows.length };
}

/** 计算某条商机在当前列表（含 leadId 筛选）下位于第几页（用于搜索点击跳转高亮） */
export async function getPageForOpportunityId(
  auth: CrmAuth,
  opportunityId: string,
  pageSize: number,
  leadId?: string
): Promise<number> {
  let where: Prisma.crm_opportunityWhereInput = !auth ? emptyWhere : auth.role === "admin" ? {} : salesFilter(auth.userId);
  if (leadId) where = { ...where, leadId };
  const opp = await prisma.crm_opportunity.findFirst({
    where: { id: opportunityId, ...where },
    select: { isKeyFocus: true, createdAt: true },
  });
  if (!opp) return 1;
  const beforeWhere: Prisma.crm_opportunityWhereInput = opp.isKeyFocus
    ? { isKeyFocus: true, createdAt: { gt: opp.createdAt } }
    : { OR: [{ isKeyFocus: true }, { isKeyFocus: false, createdAt: { gt: opp.createdAt } }] };
  const beforeCount = await prisma.crm_opportunity.count({
    where: { ...where, ...beforeWhere },
  });
  return Math.max(1, Math.ceil((beforeCount + 1) / pageSize));
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
  contactPhone?: string;
  isKeyFocus?: boolean;
  keyFocusByAdmin?: boolean;
}) {
  // 如果提供了 leadId，从线索继承 contactPhone、isKeyFocus、keyFocusByAdmin
  let contactPhone = data.contactPhone;
  let isKeyFocus = data.isKeyFocus;
  let keyFocusByAdmin = data.keyFocusByAdmin;
  if (data.leadId) {
    const lead = await prisma.crm_lead.findUnique({
      where: { id: data.leadId },
      select: { contactPhone: true, isKeyFocus: true, keyFocusByAdmin: true },
    }) as { contactPhone?: string | null; isKeyFocus?: boolean; keyFocusByAdmin?: boolean } | null;
    if (contactPhone == null) contactPhone = lead?.contactPhone ?? undefined;
    if (isKeyFocus == null) isKeyFocus = lead?.isKeyFocus ?? false;
    if (keyFocusByAdmin == null) keyFocusByAdmin = lead?.keyFocusByAdmin ?? false;
  }

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
      contactPhone,
      isKeyFocus: isKeyFocus ?? false,
      keyFocusByAdmin: keyFocusByAdmin ?? false,
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
    contactPhone?: string;
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
      ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
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
export type GetCustomersOptions = { page?: number; pageSize?: number };

/** getCustomers 返回的客户项类型（含 opportunity.lead.customerTier 用于展示客户分层，actualAmount 为 number） */
export type CustomerListItem = Omit<
  Prisma.crm_customerGetPayload<{
    include: {
      opportunity: { select: { id: true; name: true; lead: { select: { id: true; contactPhone: true; customerTier: true } } } };
      salesPerson: { select: { id: true; name: true } };
    };
  }>,
  "actualAmount"
> & { actualAmount: number | null };

export async function getCustomers(
  auth: CrmAuth,
  options: GetCustomersOptions = {}
): Promise<{ items: CustomerListItem[]; total: number }> {
  const { page, pageSize } = options;
  const where = !auth ? emptyWhere : auth.role === "admin" ? {} : salesFilter(auth.userId);
  const orderBy = [{ isKeyFocus: "desc" as const }, { createdAt: "desc" as const }];
  const include = {
    opportunity: {
      select: {
        id: true,
        name: true,
        lead: { select: { id: true, contactPhone: true, customerTier: true } },
      },
    },
    salesPerson: { select: { id: true, name: true } },
  };

  const mapAmount = (rows: Awaited<ReturnType<typeof prisma.crm_customer.findMany>>) =>
    rows.map((c) => ({ ...c, actualAmount: c.actualAmount != null ? Number(c.actualAmount) : null }));

  if (page != null && pageSize != null && page >= 1 && pageSize >= 1) {
    const [rows, total] = await Promise.all([
      prisma.crm_customer.findMany({
        where,
        orderBy,
        include,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.crm_customer.count({ where }),
    ]);
    return { items: mapAmount(rows) as CustomerListItem[], total };
  }
  const rows = await prisma.crm_customer.findMany({ where, orderBy, include });
  return { items: mapAmount(rows) as CustomerListItem[], total: rows.length };
}

/** 计算某条客户在当前列表下位于第几页（用于搜索点击跳转高亮） */
export async function getPageForCustomerId(
  auth: CrmAuth,
  customerId: string,
  pageSize: number
): Promise<number> {
  const where: Prisma.crm_customerWhereInput = !auth ? emptyWhere : auth.role === "admin" ? {} : salesFilter(auth.userId);
  const customer = await prisma.crm_customer.findFirst({
    where: { id: customerId, ...where },
    select: { isKeyFocus: true, createdAt: true },
  });
  if (!customer) return 1;
  const beforeWhere: Prisma.crm_customerWhereInput = customer.isKeyFocus
    ? { isKeyFocus: true, createdAt: { gt: customer.createdAt } }
    : { OR: [{ isKeyFocus: true }, { isKeyFocus: false, createdAt: { gt: customer.createdAt } }] };
  const beforeCount = await prisma.crm_customer.count({
    where: { ...where, ...beforeWhere },
  });
  return Math.max(1, Math.ceil((beforeCount + 1) / pageSize));
}

export async function updateCustomer(
  id: string,
  data: {
    name?: string;
    nickname?: string;
    city?: string;
    industry?: string;
    firstMaintenanceDate?: Date | null;
    employeeCount?: string;
    tags?: string;
    mainProducts?: string;
    actualAmount?: number | null;
    contactPhone?: string;
    salesPersonId?: string | null;
  }
) {
  return prisma.crm_customer.update({
    where: { id },
    data: {
      name: data.name,
      nickname: data.nickname,
      city: data.city,
      industry: data.industry,
      firstMaintenanceDate: data.firstMaintenanceDate,
      employeeCount: data.employeeCount,
      tags: data.tags,
      mainProducts: data.mainProducts,
      actualAmount: data.actualAmount,
      ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
      ...(data.salesPersonId !== undefined && { salesPersonId: data.salesPersonId }),
    },
  });
}

/** 批量更新客户负责人 */
export async function updateCustomerSalesPersonBatch(
  customerIds: string[],
  salesPersonId: string | null
) {
  if (customerIds.length === 0) return;
  await prisma.crm_customer.updateMany({
    where: { id: { in: customerIds } },
    data: { salesPersonId },
  });
}

/** 批量删除客户：先解除跟进记录关联、删掉客户（级联删资料记录），再删除 Vercel Blob 上的资料文件 */
export async function deleteCustomers(customerIds: string[]) {
  if (customerIds.length === 0) return;
  const materials = await prisma.crm_customer_material.findMany({
    where: { customerId: { in: customerIds } },
    select: { blobUrl: true },
  });
  const blobUrls = materials.map((m) => m.blobUrl);

  await prisma.$transaction(async (tx) => {
    await tx.crm_follow_up.updateMany({
      where: { customerId: { in: customerIds } },
      data: { customerId: null },
    });
    await tx.crm_customer.deleteMany({
      where: { id: { in: customerIds } },
    });
  });

  for (const url of blobUrls) {
    try {
      await del(url);
    } catch (e) {
      console.warn("删除客户资料 Blob 失败（可能已不存在）:", url, e);
    }
  }
}

// ============ 跟进记录 ============
/** 跟进记录列表。无 filters 时：admin 看全部，sales 仅看自己跟进或自己负责的线索/商机/客户的记录 */
export type GetFollowUpsOptions = { page?: number; pageSize?: number };

/** getFollowUps 返回的跟进项类型（含 followUpBy、lead、customer、opportunity） */
export type FollowUpListItem = Prisma.crm_follow_upGetPayload<{
  include: {
    followUpBy: { select: { id: true; name: true } };
    lead: { select: { id: true; customerName: true } };
    customer: { select: { id: true; name: true } };
    opportunity: { select: { id: true; name: true } };
  };
}>;

export async function getFollowUps(
  auth: CrmAuth,
  filters?: { leadId?: string; customerId?: string; opportunityId?: string },
  options: GetFollowUpsOptions = {}
): Promise<{ items: FollowUpListItem[]; total: number }> {
  const { page, pageSize } = options;
  let where: Record<string, unknown> = filters ?? {};
  if (!auth) {
    where = { ...where, id: "00000000-0000-0000-0000-000000000000" };
  } else if (auth.role === "sales" && auth.userId) {
    where = {
      ...where,
      OR: [
        { followUpById: auth.userId },
        { lead: { assignees: { some: { userId: auth.userId } } } },
        { customer: { salesPersonId: auth.userId } },
        { opportunity: { salesPersonId: auth.userId } },
      ],
    };
  }
  const orderBy = { followDate: "desc" as const };
  const include = {
    followUpBy: { select: { id: true, name: true } },
    lead: { select: { id: true, customerName: true } },
    customer: { select: { id: true, name: true } },
    opportunity: { select: { id: true, name: true } },
  };

  if (page != null && pageSize != null && page >= 1 && pageSize >= 1) {
    const [items, total] = await Promise.all([
      prisma.crm_follow_up.findMany({
        where,
        orderBy,
        include,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.crm_follow_up.count({ where }),
    ]);
    return { items: items as FollowUpListItem[], total };
  }
  const items = await prisma.crm_follow_up.findMany({ where, orderBy, include });
  return { items: items as FollowUpListItem[], total: items.length };
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
  transitionType?: string | null; // lead_to_opportunity | opportunity_to_customer，删除该条时联动撤回
}) {
  if (!data.leadId && !data.customerId && !data.opportunityId) {
    throw new Error("跟进记录至少关联线索、商机或客户之一");
  }
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
      transitionType: data.transitionType ?? undefined,
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
            { lead: { assignees: { some: { userId: auth.userId } } } },
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
      _count: { select: { images: true } },
    },
  });
}

/** 按需获取某条跟进的图片列表（不校验权限，由调用方先确认可见性） */
export async function getFollowUpImages(followUpId: string) {
  return prisma.crm_follow_up_image.findMany({
    where: { followUpId },
    orderBy: { uploadedAt: "asc" },
    select: { id: true, blobUrl: true, fileName: true, uploadedAt: true },
  });
}

/** 获取单条跟进（仅当当前用户有权限查看时返回，用于 GET images / 补传 / 删图 前校验） */
export async function getFollowUpByIdIfVisible(
  auth: CrmAuth,
  followUpId: string
) {
  if (!auth) return null;
  const row = await prisma.crm_follow_up.findUnique({
    where: { id: followUpId },
    select: {
      id: true,
      followUpById: true,
      leadId: true,
      customerId: true,
      opportunityId: true,
      transitionType: true,
      lead: { select: { assignees: { where: { userId: auth.userId }, select: { userId: true } } } },
      customer: { select: { salesPersonId: true } },
      opportunity: { select: { salesPersonId: true } },
    },
  });
  if (!row) return null;
  if (auth.role === "admin") return row;
  if (row.followUpById === auth.userId) return row;
  if (row.lead?.assignees?.length) return row;
  if (row.customer?.salesPersonId === auth.userId) return row;
  if (row.opportunity?.salesPersonId === auth.userId) return row;
  return null;
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

/** 删除状态变更跟进时的业务撤回：根据 transitionType 联动删除/回滚商机或客户 */
export async function rollbackFollowUpTransition(row: {
  transitionType: string | null;
  leadId: string | null;
  opportunityId: string | null;
}) {
  const { transitionType, leadId, opportunityId } = row;
  if (transitionType === "lead_to_opportunity" && leadId) {
    const lead = await prisma.crm_lead.findUnique({
      where: { id: leadId, deletedAt: null },
      include: { opportunity: { include: { customer: true } } },
    });
    if (lead?.opportunity) {
      if (lead.opportunity.customer) {
        await prisma.crm_customer.delete({ where: { id: lead.opportunity.customer.id } });
      }
      await prisma.crm_opportunity.delete({ where: { id: lead.opportunity.id } });
      await prisma.crm_lead.update({
        where: { id: leadId },
        data: { status: "未跟进" },
      });
    }
    return;
  }
  if (transitionType === "opportunity_to_customer" && opportunityId) {
    const opp = await prisma.crm_opportunity.findUnique({
      where: { id: opportunityId },
      include: { customer: true },
    });
    if (opp?.customer) {
      await prisma.crm_customer.delete({ where: { id: opp.customer.id } });
    }
    if (opp) {
      await prisma.crm_opportunity.update({
        where: { id: opportunityId },
        data: { status: "方案确认" },
      });
    }
  }
}

/** 删除跟进记录：先删该跟进下所有图片（Vercel Blob），再删跟进（DB 级联删 crm_follow_up_image） */
export async function deleteFollowUp(id: string) {
  const images = await prisma.crm_follow_up_image.findMany({
    where: { followUpId: id },
    select: { blobUrl: true, pathname: true },
  });
  for (const img of images) {
    try {
      await del(img.blobUrl);
    } catch (e) {
      console.warn("删除跟进图片 Blob 失败（可能已不存在）:", img.blobUrl, e);
    }
  }
  return prisma.crm_follow_up.delete({ where: { id } });
}

// ============ 状态流转（核心逻辑） ============

/**
 * 若线索状态为「有意向」且尚未有关联商机，则创建商机；否则不操作（幂等）。
 * 用于在任意入口把状态改为「有意向」后统一保证数据一致（如编辑页、updateLead 等）。
 */
export async function ensureLeadHasOpportunityIfIntent(leadId: string) {
  try {
    await leadToOpportunity(leadId);
  } catch (e) {
    // 已有商机或状态非有意向时 leadToOpportunity 会抛，忽略即可
    if (
      !(e instanceof Error) ||
      (!e.message.includes("已转入商机") && !e.message.includes("仅当线索状态"))
    ) {
      throw e;
    }
  }
}

/** 线索转商机：当状态变为「有意向」时调用 */
export async function leadToOpportunity(leadId: string) {
  const lead = await prisma.crm_lead.findUnique({
    where: { id: leadId, deletedAt: null }, // 已删除的线索不能转商机
    include: {
      assignees: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { userId: true },
      },
    },
  });
  if (!lead) throw new Error("线索不存在或已被删除");
  if (lead.status !== "有意向") throw new Error("仅当线索状态为「有意向」时可转入商机");

  const existing = await prisma.crm_opportunity.findUnique({ where: { leadId } });
  if (existing) throw new Error("该线索已转入商机");

  const leadRow = lead as { isKeyFocus?: boolean; keyFocusByAdmin?: boolean };
  const primaryAssigneeId = lead.assignees?.[0]?.userId ?? null;
  const opportunity = await prisma.crm_opportunity.create({
    data: {
      name: lead.customerName,
      leadId: lead.id,
      productType: null,
      status: "初步沟通",
      salesPersonId: primaryAssigneeId,
      contactPhone: lead.contactPhone, // 继承线索的联系方式
      isKeyFocus: leadRow.isKeyFocus ?? false,
      keyFocusByAdmin: leadRow.keyFocusByAdmin ?? false,
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
  // 继承联系方式：优先使用商机的 contactPhone，否则使用线索的 contactPhone
  const contactPhone = opp.contactPhone ?? lead?.contactPhone ?? null;

  const oppRow = opp as { isKeyFocus?: boolean; keyFocusByAdmin?: boolean };
  const customer = await prisma.crm_customer.create({
    data: {
      name: lead?.customerName ?? opp.name,
      nickname: lead?.nickname ?? null,
      city: lead?.city ?? null,
      industry: lead?.industry ?? null,
      opportunityId: opp.id,
      salesPersonId: opp.salesPersonId,
      status: opp.status === "已赢单" ? "已签约" : "预备签约",
      contactPhone,
      isKeyFocus: oppRow.isKeyFocus ?? false,
      keyFocusByAdmin: oppRow.keyFocusByAdmin ?? false,
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

/** 通知中心：获取当前用户相关的指派/转派简讯（被指派、被转走等） */
export async function getNotificationsForUser(auth: CrmAuth, limit = 50) {
  if (!auth) return [];

  const where =
    auth.role === "admin"
      ? {}
      : {
        OR: [
          { oldSalesPersonId: auth.userId },
          { newSalesPersonId: auth.userId },
        ],
      };

  return prisma.crm_lead_assignment_notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      lead: { select: { id: true, customerName: true } },
      oldSalesPerson: { select: { id: true, name: true } },
      newSalesPerson: { select: { id: true, name: true } },
    },
  });
}

/** 全局搜索：线索、商机、客户（遵守 CRM 权限），分栏展示，每表单独分页 */
export type GlobalSearchItem = {
  type: "lead" | "opportunity" | "customer";
  id: string;
  title: string;
  subtitle?: string;
  createdAt: Date;
};

export type GlobalSearchResult = {
  leads: { items: GlobalSearchItem[]; total: number };
  opportunities: { items: GlobalSearchItem[]; total: number };
  customers: { items: GlobalSearchItem[]; total: number };
};

const SEARCH_PAGE_SIZE = 5;

export async function globalSearchCrm(
  auth: CrmAuth,
  keyword: string,
  leadPage: number,
  oppPage: number,
  customerPage: number
): Promise<GlobalSearchResult> {
  const k = keyword?.trim();
  const empty = { items: [] as GlobalSearchItem[], total: 0 };
  if (!auth || !k) {
    return { leads: empty, opportunities: empty, customers: empty };
  }

  const baseWhere = auth.role === "admin" ? {} : salesFilter(auth.userId);
  const leadBase = buildLeadWhere(auth);
  const orLead = [
    { customerName: { contains: k, mode: "insensitive" as const } },
    { nickname: { contains: k, mode: "insensitive" as const } },
    { contactPhone: { contains: k, mode: "insensitive" as const } },
    { city: { contains: k, mode: "insensitive" as const } },
    { address: { contains: k, mode: "insensitive" as const } },
    { industry: { contains: k, mode: "insensitive" as const } },
    { leadSource: { contains: k, mode: "insensitive" as const } },
    { customerTier: { contains: k, mode: "insensitive" as const } },
    { assignees: { some: { user: { name: { contains: k, mode: "insensitive" as const } } } } },
  ];
  const orOpp = [
    { name: { contains: k, mode: "insensitive" as const } },
    { productType: { contains: k, mode: "insensitive" as const } },
    { contactPhone: { contains: k, mode: "insensitive" as const } },
    { lostReason: { contains: k, mode: "insensitive" as const } },
    { salesPerson: { name: { contains: k, mode: "insensitive" as const } } },
    { deliveryPerson: { name: { contains: k, mode: "insensitive" as const } } },
  ];
  const orCustomer = [
    { name: { contains: k, mode: "insensitive" as const } },
    { nickname: { contains: k, mode: "insensitive" as const } },
    { city: { contains: k, mode: "insensitive" as const } },
    { industry: { contains: k, mode: "insensitive" as const } },
    { contactPhone: { contains: k, mode: "insensitive" as const } },
    { mainProducts: { contains: k, mode: "insensitive" as const } },
    { tags: { contains: k, mode: "insensitive" as const } },
    { salesPerson: { name: { contains: k, mode: "insensitive" as const } } },
  ];

  const leadWhere = { ...leadBase, OR: orLead };
  const oppWhere = { ...baseWhere, OR: orOpp };
  const customerWhere = { ...baseWhere, OR: orCustomer };

  const [leadsCount, oppsCount, customersCount, leads, opportunities, customers] = await Promise.all([
    prisma.crm_lead.count({ where: leadWhere }),
    prisma.crm_opportunity.count({ where: oppWhere }),
    prisma.crm_customer.count({ where: customerWhere }),
    prisma.crm_lead.findMany({
      where: leadWhere,
      orderBy: { createdAt: "desc" },
      skip: leadPage * SEARCH_PAGE_SIZE,
      take: SEARCH_PAGE_SIZE,
      select: { id: true, customerName: true, contactPhone: true, createdAt: true },
    }),
    prisma.crm_opportunity.findMany({
      where: oppWhere,
      orderBy: { createdAt: "desc" },
      skip: oppPage * SEARCH_PAGE_SIZE,
      take: SEARCH_PAGE_SIZE,
      select: { id: true, name: true, contactPhone: true, createdAt: true },
    }),
    prisma.crm_customer.findMany({
      where: customerWhere,
      orderBy: { createdAt: "desc" },
      skip: customerPage * SEARCH_PAGE_SIZE,
      take: SEARCH_PAGE_SIZE,
      select: { id: true, name: true, contactPhone: true, createdAt: true },
    }),
  ]);

  const leadItems: GlobalSearchItem[] = leads.map((l) => ({
    type: "lead",
    id: l.id,
    title: l.customerName,
    subtitle: l.contactPhone ?? undefined,
    createdAt: l.createdAt,
  }));
  const oppItems: GlobalSearchItem[] = opportunities.map((o) => ({
    type: "opportunity",
    id: o.id,
    title: o.name,
    subtitle: o.contactPhone ?? undefined,
    createdAt: o.createdAt,
  }));
  const customerItems: GlobalSearchItem[] = customers.map((c) => ({
    type: "customer",
    id: c.id,
    title: c.name,
    subtitle: c.contactPhone ?? undefined,
    createdAt: c.createdAt,
  }));

  return {
    leads: { items: leadItems, total: leadsCount },
    opportunities: { items: oppItems, total: oppsCount },
    customers: { items: customerItems, total: customersCount },
  };
}
