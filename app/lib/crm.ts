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
  let departmentId: string | null = null;
  try {
    const roleResult = await prisma.$queryRaw<{ role: string | null; department_id: string | null }[]>`
      SELECT role, department_id FROM users WHERE id::text = ${userId}
    `;
    role = roleResult[0]?.role ?? "sales";
    departmentId = roleResult[0]?.department_id ?? null;
  } catch {
    role = (session?.user as { role?: string })?.role ?? "sales";
  }
  return { userId, role, departmentId };
}

/** 获取所有已注册用户（供表单人员选择） */
export async function getUsers(auth?: CrmAuth) {
  const scopedAuth = auth ?? (await getCrmAuth());
  if (!scopedAuth?.departmentId) return [];
  return prisma.users.findMany({
    where: { departmentId: scopedAuth.departmentId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// ============ 常量（从独立文件导入，便于客户端组件使用） ============
export { LEAD_STATUS, OPPORTUNITY_STATUS, CUSTOMER_STATUS } from "./crm-constants";

export type CrmAuth = { userId: string; role: string; departmentId: string | null } | null;

/** 销售负责人全量同步时至少保留一人 */
export const CRM_ASSIGNEE_MIN_ONE_ERROR = "至少保留一位销售负责人";

export function normalizeDealAssigneeUserIds(userIds: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of userIds) {
    if (!id || typeof id !== "string") continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function opportunitySalesWhere(auth: NonNullable<CrmAuth>): Prisma.crm_opportunityWhereInput {
  if (!auth.departmentId) return emptyWhere;
  return {
    departmentId: auth.departmentId,
    OR: [{ salesPersonId: auth.userId }, { assignees: { some: { userId: auth.userId } } }],
  };
}

function customerSalesWhere(auth: NonNullable<CrmAuth>): Prisma.crm_customerWhereInput {
  if (!auth.departmentId) return emptyWhere;
  return {
    departmentId: auth.departmentId,
    OR: [{ salesPersonId: auth.userId }, { assignees: { some: { userId: auth.userId } } }],
  };
}

/** 客户资料 API：admin 或主负责人/assignee 之一 */
export function canAccessCustomerAsSales(
  row: { salesPersonId: string | null; assignees: { userId: string }[] },
  userId: string,
  role: string
): boolean {
  if (role === "admin") return true;
  if (row.salesPersonId === userId) return true;
  return row.assignees.some((a) => a.userId === userId);
}

function leadAssigneeFilter(userId: string): Prisma.crm_leadWhereInput {
  return { assignees: { some: { userId } } };
}

function leadScopeWhere(auth: CrmAuth): Prisma.crm_leadWhereInput {
  if (!auth?.departmentId) return emptyWhere;
  if (auth.role === "admin") return { departmentId: auth.departmentId };
  return { departmentId: auth.departmentId, ...leadAssigneeFilter(auth.userId) };
}

function opportunityScopeWhere(auth: CrmAuth): Prisma.crm_opportunityWhereInput {
  if (!auth?.departmentId) return emptyWhere;
  if (auth.role === "admin") return { departmentId: auth.departmentId };
  return opportunitySalesWhere(auth);
}

function customerScopeWhere(auth: CrmAuth): Prisma.crm_customerWhereInput {
  if (!auth?.departmentId) return emptyWhere;
  if (auth.role === "admin") return { departmentId: auth.departmentId };
  return customerSalesWhere(auth);
}

async function assertUsersInDepartment(
  tx: Prisma.TransactionClient | typeof prisma,
  userIds: string[],
  departmentId: string
) {
  if (userIds.length === 0) return;
  const rows = await tx.users.findMany({
    where: { id: { in: userIds } },
    select: { id: true, departmentId: true },
  });
  if (rows.length !== userIds.length) throw new Error("负责人包含不存在的用户");
  const invalid = rows.find((u) => u.departmentId !== departmentId);
  if (invalid) throw new Error("负责人必须属于同一部门");
}

/** 未登录时返回空数据（理论上 middleware 会拦截，此处兜底） */
const emptyWhere = { id: "00000000-0000-0000-0000-000000000000" }; // 不可能存在的 id

/**
 * 构建线索查询条件（统一处理权限和软删除）
 * @param auth 权限上下文
 * @param includeDeleted 是否包含已删除的记录（默认 false，仅管理员恢复时使用）
 */
function buildLeadWhere(auth: CrmAuth, includeDeleted = false) {
  const base = leadScopeWhere(auth);

  // 软删除过滤：默认只查询未删除的记录
  const deletedFilter = includeDeleted ? {} : { deletedAt: null };

  return { ...base, ...deletedFilter };
}

// ============ 驾驶舱统计 ============
/** 驾驶舱统计（含漏斗看板所需：已签约、待签约、商机、本月计划） */
export async function getCrmCounts(auth: CrmAuth) {
  const leadWhere = buildLeadWhere(auth);
  const oppBase = opportunityScopeWhere(auth);
  const custBase = customerScopeWhere(auth);
  const d = new Date();
  const planMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const mpWhere: Prisma.crm_monthly_plan_leadWhereInput = {
    planMonth,
    ...(auth?.role === "sales" && auth?.userId ? { userId: auth.userId } : {}),
  };
  const [
    leadCount,
    opportunityCount,
    customerCount,
    signedCustomerCount,
    pendingCustomerCount,
    monthlyPlanRows,
  ] = await Promise.all([
    prisma.crm_lead.count({ where: leadWhere }),
    prisma.crm_opportunity.count({ where: oppBase }),
    prisma.crm_customer.count({ where: custBase }),
    prisma.crm_customer.count({ where: { ...custBase, status: "已签约" } }),
    prisma.crm_customer.count({ where: { ...custBase, status: "预备签约" } }),
    prisma.crm_monthly_plan_lead.findMany({
      where: mpWhere,
      select: { leadId: true },
    }),
  ]);
  const monthlyPlanCount = new Set(monthlyPlanRows.map((r) => r.leadId)).size;
  return {
    leadCount,
    opportunityCount,
    customerCount,
    signedCustomerCount,
    pendingCustomerCount,
    monthlyPlanCount,
  };
}

/** 驾驶舱图表数据：状态分布、来源分布、近 7 天趋势 */
export type DashboardChartData = {
  leadStatusDistribution: { name: string; value: number }[];
  opportunityStatusDistribution: { name: string; value: number }[];
  leadSourceDistribution: { name: string; value: number }[];
  dailyTrend: { date: string; leads: number; opportunities: number; customers: number }[];
};

export async function getCrmDashboardCharts(auth: CrmAuth): Promise<DashboardChartData> {
  const leadWhere = buildLeadWhere(auth);
  const oppBase = opportunityScopeWhere(auth);
  const custBase = customerScopeWhere(auth);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    leadStatusGroups,
    oppStatusGroups,
    leadSourceGroups,
    recentLeads,
    recentOpps,
    recentCustomers,
  ] = await Promise.all([
    prisma.crm_lead.groupBy({
      by: ["status"],
      where: leadWhere,
      _count: { status: true },
    }),
    prisma.crm_opportunity.groupBy({
      by: ["status"],
      where: oppBase,
      _count: { status: true },
    }),
    prisma.crm_lead.groupBy({
      by: ["leadSource"],
      where: {
        ...leadWhere,
        AND: [
          { leadSource: { not: null } },
          { leadSource: { not: "" } },
        ],
      },
      _count: { leadSource: true },
    }),
    prisma.crm_lead.findMany({
      where: { ...leadWhere, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.crm_opportunity.findMany({
      where: { ...oppBase, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.crm_customer.findMany({
      where: { ...custBase, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
  ]);

  const dateKey = (d: Date) => d.toISOString().slice(0, 10);
  const initDates = () => {
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(dateKey(d));
    }
    return dates;
  };
  const allDates = initDates();
  const countByDate = (
    items: { createdAt: Date }[],
    keyFn: (d: Date) => string
  ) => {
    const m = new Map<string, number>();
    allDates.forEach((d) => m.set(d, 0));
    items.forEach((item) => {
      const k = keyFn(item.createdAt);
      if (m.has(k)) m.set(k, (m.get(k) ?? 0) + 1);
    });
    return m;
  };

  const leadByDate = countByDate(recentLeads, (d) => dateKey(d));
  const oppByDate = countByDate(recentOpps, (d) => dateKey(d));
  const customerByDate = countByDate(recentCustomers, (d) => dateKey(d));

  return {
    leadStatusDistribution: leadStatusGroups.map((g) => ({
      name: g.status,
      value: g._count.status,
    })),
    opportunityStatusDistribution: oppStatusGroups.map((g) => ({
      name: g.status,
      value: g._count.status,
    })),
    leadSourceDistribution: leadSourceGroups
      .filter((g) => g.leadSource)
      .map((g) => ({
        name: g.leadSource!,
        value: g._count.leadSource,
      })),
    dailyTrend: allDates.map((date) => ({
      date: date.slice(5),
      leads: leadByDate.get(date) ?? 0,
      opportunities: oppByDate.get(date) ?? 0,
      customers: customerByDate.get(date) ?? 0,
    })),
  };
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

/** 线索管理表支持的排序字段 */
export const LEADS_SORT_FIELDS = ["customerName", "createdAt", "city", "industry", "status", "leadSource", "contactPerson"] as const;

export type GetLeadsOptions = {
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
  /** 筛选条件，来自 URL 解码 */
  filter?: LeadFilter;
  sortBy?: (typeof LEADS_SORT_FIELDS)[number];
  sortOrder?: "asc" | "desc";
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
  const { includeDeleted = false, page, pageSize, filter, sortBy, sortOrder } = options;
  const baseWhere = buildLeadWhere(auth, includeDeleted);
  const filterWhere = buildLeadWhereFromFilter(filter);
  const where: Prisma.crm_leadWhereInput = {
    ...baseWhere,
    ...filterWhere,
  };
  const validSortBy = sortBy && LEADS_SORT_FIELDS.includes(sortBy) ? sortBy : "createdAt";
  const order = sortOrder === "asc" ? "asc" : "desc";
  const orderBy: Prisma.crm_leadOrderByWithRelationInput[] = [
    { isKeyFocus: "desc" as const },
    { [validSortBy]: order } as Prisma.crm_leadOrderByWithRelationInput,
    { createdAt: "desc" as const },
  ];
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

/** 计算某条线索在当前筛选与排序下位于第几页（用于搜索点击跳转高亮）。若线索不存在或已删除则返回 null。仅默认排序（createdAt 降序）时支持定位 */
export async function getPageForLeadId(
  auth: CrmAuth,
  leadId: string,
  filter: LeadFilter | undefined,
  pageSize: number,
  sortBy?: (typeof LEADS_SORT_FIELDS)[number],
  sortOrder?: "asc" | "desc"
): Promise<number | null> {
  if (sortBy !== "createdAt" && sortBy !== undefined) return null;
  if (sortOrder === "asc") return null;
  const baseWhere = buildLeadWhere(auth, false);
  const filterWhere = buildLeadWhereFromFilter(filter);
  const listWhere: Prisma.crm_leadWhereInput = { ...baseWhere, ...filterWhere };
  const lead = await prisma.crm_lead.findFirst({
    where: { id: leadId, ...listWhere },
    select: { isKeyFocus: true, createdAt: true },
  });
  if (!lead) return null;
  const beforeWhere: Prisma.crm_leadWhereInput = lead.isKeyFocus
    ? { isKeyFocus: true, createdAt: { gt: lead.createdAt } }
    : { OR: [{ isKeyFocus: true }, { isKeyFocus: false, createdAt: { gt: lead.createdAt } }] };
  const beforeCount = await prisma.crm_lead.count({
    where: { ...listWhere, ...beforeWhere },
  });
  return Math.max(1, Math.ceil((beforeCount + 1) / pageSize));
}

const MAX_LEAD_IDS_FOR_SELECT_ALL = 5000;

// ============ 本月计划 ============
/** 获取当前月份字符串，如 "2026-03" */
function getCurrentPlanMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type MonthlyPlanLeadItem = LeadListItem & {
  /** 转化状态：未转化 | 已转商机 | 已转客户 */
  conversionStatus: "未转化" | "已转商机" | "已转客户";
  /** 本月是否有任意跟进记录 */
  hasFollowUpThisMonth: boolean;
};

export type MonthlyPlanStats = {
  total: number;
  contacted: number;
  opportunityCount: number;
  customerCount: number;
};

export type MonthlyPlanStatsByUser = {
  userId: string;
  userName: string;
  total: number;
  contacted: number;
  opportunityCount: number;
  customerCount: number;
};

/** 本月计划支持的排序字段 */
export const MONTHLY_PLAN_SORT_FIELDS = ["customerName", "createdAt", "city", "industry", "status", "leadSource"] as const;

/** 获取本月计划线索列表 */
export async function getMonthlyPlanLeads(
  auth: CrmAuth,
  options: {
    planMonth?: string;
    userId?: string; // 筛选指定跟进人，admin 用；sales 自动用自己的
    page?: number;
    pageSize?: number;
    filter?: LeadFilter;
    sortBy?: (typeof MONTHLY_PLAN_SORT_FIELDS)[number];
    sortOrder?: "asc" | "desc";
  } = {}
): Promise<{ items: MonthlyPlanLeadItem[]; total: number }> {
  const planMonth = options.planMonth ?? getCurrentPlanMonth();
  const effectiveUserId = options.userId ?? (auth?.role === "admin" ? undefined : auth?.userId);
  if (!auth) return { items: [], total: 0 };

  const monthStart = new Date(planMonth + "-01");
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const mpWhere: Prisma.crm_monthly_plan_leadWhereInput = {
    planMonth,
    user: { departmentId: auth.departmentId ?? undefined },
    ...(effectiveUserId && { userId: effectiveUserId }),
  };

  const leadIds = await prisma.crm_monthly_plan_lead.findMany({
    where: mpWhere,
    select: { leadId: true },
  });
  const ids = leadIds.map((r) => r.leadId);
  if (ids.length === 0) return { items: [], total: 0 };

  const baseWhere: Prisma.crm_leadWhereInput = {
    id: { in: ids },
    departmentId: auth.departmentId ?? undefined,
    deletedAt: null,
  };
  const filterWhere = buildLeadWhereFromFilter(options.filter);
  const where: Prisma.crm_leadWhereInput = { ...baseWhere, ...filterWhere };

  const include = {
    assignees: { orderBy: { createdAt: "asc" as const }, include: { user: { select: { id: true, name: true } } } },
    opportunity: {
      select: { id: true, name: true, customer: { select: { id: true, status: true } } },
    },
    followUps: {
      where: { followDate: { gte: monthStart, lt: monthEnd } },
      select: { id: true },
    },
  };

  const validSortBy = options.sortBy && MONTHLY_PLAN_SORT_FIELDS.includes(options.sortBy) ? options.sortBy : "createdAt";
  const sortOrder = options.sortOrder === "asc" ? "asc" : "desc";
  const orderBy: Prisma.crm_leadOrderByWithRelationInput[] = [
    { isKeyFocus: "desc" as const },
    { [validSortBy]: sortOrder } as Prisma.crm_leadOrderByWithRelationInput,
    { createdAt: "desc" as const },
  ];

  const [rows, total] = await Promise.all([
    prisma.crm_lead.findMany({
      where,
      orderBy,
      include,
      skip: options.page && options.pageSize ? (options.page - 1) * options.pageSize : 0,
      take: options.page && options.pageSize ? options.pageSize : 1000,
    }),
    prisma.crm_lead.count({ where }),
  ]);

  const items: MonthlyPlanLeadItem[] = rows.map((r) => {
    const opp = r.opportunity;
    const hasCustomer = opp?.customer != null;
    const hasOpp = opp != null;
    const conversionStatus: "未转化" | "已转商机" | "已转客户" = hasCustomer
      ? "已转客户"
      : hasOpp
        ? "已转商机"
        : "未转化";
    const hasFollowUpThisMonth = (r.followUps?.length ?? 0) > 0;
    const { followUps, ...rest } = r;
    return {
      ...rest,
      conversionStatus,
      hasFollowUpThisMonth,
    } as MonthlyPlanLeadItem;
  });

  return { items, total };
}

/** 获取本月计划统计（基于当前筛选） */
export async function getMonthlyPlanStats(
  auth: CrmAuth,
  options: { planMonth?: string; userId?: string } = {}
): Promise<MonthlyPlanStats> {
  const planMonth = options.planMonth ?? getCurrentPlanMonth();
  const effectiveUserId = options.userId ?? (auth?.role === "admin" ? undefined : auth?.userId);
  if (!auth) return { total: 0, contacted: 0, opportunityCount: 0, customerCount: 0 };

  const mpWhere: Prisma.crm_monthly_plan_leadWhereInput = {
    planMonth,
    user: { departmentId: auth.departmentId ?? undefined },
    ...(effectiveUserId && { userId: effectiveUserId }),
  };
  const leadIds = await prisma.crm_monthly_plan_lead.findMany({
    where: mpWhere,
    select: { leadId: true },
  });
  const ids = leadIds.map((r) => r.leadId);
  if (ids.length === 0) return { total: 0, contacted: 0, opportunityCount: 0, customerCount: 0 };

  const baseWhere: Prisma.crm_leadWhereInput = {
    id: { in: ids },
    departmentId: auth.departmentId ?? undefined,
    deletedAt: null,
  };

  const monthStart = new Date(planMonth + "-01");
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const [total, contactedLeads, withOpp, withCustomer] = await Promise.all([
    prisma.crm_lead.count({ where: baseWhere }),
    prisma.crm_lead.count({
      where: {
        ...baseWhere,
        followUps: { some: { followDate: { gte: monthStart, lt: monthEnd } } },
      },
    }),
    prisma.crm_lead.count({
      where: { ...baseWhere, opportunity: { isNot: null } },
    }),
    prisma.crm_lead.count({
      where: { ...baseWhere, opportunity: { customer: { isNot: null } } },
    }),
  ]);

  return {
    total,
    contacted: contactedLeads,
    opportunityCount: withOpp,
    customerCount: withCustomer,
  };
}

/** 获取本月计划按人员汇总统计（仅 admin） */
export async function getMonthlyPlanStatsByUser(
  auth: CrmAuth,
  planMonth?: string
): Promise<MonthlyPlanStatsByUser[]> {
  if (!auth || auth.role !== "admin" || !auth.departmentId) return [];
  const month = planMonth ?? getCurrentPlanMonth();

  const entries = await prisma.crm_monthly_plan_lead.findMany({
    where: { planMonth: month, user: { departmentId: auth.departmentId } },
    include: { user: { select: { id: true, name: true } } },
  });

  const byUser = new Map<string, { user: { id: string; name: string }; leadIds: string[] }>();
  for (const e of entries) {
    const u = e.user;
    if (!byUser.has(u.id)) byUser.set(u.id, { user: u, leadIds: [] });
    byUser.get(u.id)!.leadIds.push(e.leadId);
  }

  const result: MonthlyPlanStatsByUser[] = [];
  for (const [userId, { user, leadIds }] of byUser) {
    if (leadIds.length === 0) continue;
    const monthStart = new Date(month + "-01");
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const leads = await prisma.crm_lead.findMany({
      where: { id: { in: leadIds }, deletedAt: null, departmentId: auth.departmentId },
      include: {
        followUps: {
          where: { followDate: { gte: monthStart, lt: monthEnd } },
          select: { id: true },
        },
        opportunity: { select: { id: true, customer: { select: { id: true } } } },
      },
    });

    let contacted = 0;
    let opportunityCount = 0;
    let customerCount = 0;
    for (const l of leads) {
      if ((l.followUps?.length ?? 0) > 0) contacted++;
      if (l.opportunity?.customer) customerCount++;
      else if (l.opportunity) opportunityCount++;
    }

    result.push({
      userId,
      userName: user.name,
      total: leadIds.length,
      contacted,
      opportunityCount,
      customerCount,
    });
  }
  return result.sort((a, b) => b.total - a.total);
}

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
  if (!auth || auth.role !== "admin" || !auth.departmentId) return [];

  return prisma.crm_lead.findMany({
    where: {
      departmentId: auth.departmentId,
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
  const scope = leadScopeWhere(auth);
  const baseWhere = { id, ...scope };
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
  const auth = await getCrmAuth();
  if (!auth?.departmentId) throw new Error("当前账号未绑定部门，无法创建线索");
  const assigneeIds = (data.assigneeIds ?? []).filter(Boolean);
  await assertUsersInDepartment(prisma, assigneeIds, auth.departmentId);
  return prisma.crm_lead.create({
    data: {
      departmentId: auth.departmentId,
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
        assignees: {
          create: assigneeIds.map((userId) => ({
            userId,
            departmentId: auth.departmentId!,
          })),
        },
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

/**
 * 以线索为锚，全量同步销售负责人到线索 / 关联商机 / 关联客户；并更新商机与客户上的 salesPersonId（主负责人 = 列表第一项）。
 */
export async function syncDealSalesAssignees(leadId: string, userIds: string[]) {
  const ids = normalizeDealAssigneeUserIds(userIds);
  if (ids.length === 0) throw new Error(CRM_ASSIGNEE_MIN_ONE_ERROR);

  await prisma.$transaction(async (tx) => {
    const leadMeta = await tx.crm_lead.findUnique({
      where: { id: leadId },
      select: { departmentId: true },
    });
    if (!leadMeta) throw new Error("线索不存在");
    await assertUsersInDepartment(tx, ids, leadMeta.departmentId);

    await tx.crm_lead_assignee.deleteMany({ where: { leadId } });
    await tx.crm_lead_assignee.createMany({
      data: ids.map((userId) => ({ leadId, userId, departmentId: leadMeta.departmentId })),
      skipDuplicates: true,
    });

    const primaryId = ids[0]!;
    const lead = await tx.crm_lead.findUnique({
      where: { id: leadId },
      select: {
        opportunity: { select: { id: true, customer: { select: { id: true } } } },
      },
    });

    if (lead?.opportunity) {
      const oppId = lead.opportunity.id;
      await tx.crm_opportunity_assignee.deleteMany({ where: { opportunityId: oppId } });
      await tx.crm_opportunity_assignee.createMany({
        data: ids.map((userId) => ({
          opportunityId: oppId,
          userId,
          departmentId: leadMeta.departmentId,
        })),
        skipDuplicates: true,
      });
      await tx.crm_opportunity.update({
        where: { id: oppId },
        data: { salesPersonId: primaryId, departmentId: leadMeta.departmentId },
      });
      if (lead.opportunity.customer) {
        const custId = lead.opportunity.customer.id;
        await tx.crm_customer_assignee.deleteMany({ where: { customerId: custId } });
        await tx.crm_customer_assignee.createMany({
          data: ids.map((userId) => ({
            customerId: custId,
            userId,
            departmentId: leadMeta.departmentId,
          })),
          skipDuplicates: true,
        });
        await tx.crm_customer.update({
          where: { id: custId },
          data: { salesPersonId: primaryId, departmentId: leadMeta.departmentId },
        });
      }
    }
  });
}

/** 无关联线索的商机：仅同步商机与客户 assignee（用于 leadId 为空的边缘数据） */
export async function syncOppCustomerAssigneesWithoutLead(opportunityId: string, userIds: string[]) {
  const ids = normalizeDealAssigneeUserIds(userIds);
  if (ids.length === 0) throw new Error(CRM_ASSIGNEE_MIN_ONE_ERROR);

  await prisma.$transaction(async (tx) => {
    const opp = await tx.crm_opportunity.findUnique({
      where: { id: opportunityId },
      include: { customer: { select: { id: true } } },
    });
    if (!opp) throw new Error("商机不存在");
    await assertUsersInDepartment(tx, ids, opp.departmentId);

    const primaryId = ids[0]!;
    await tx.crm_opportunity_assignee.deleteMany({ where: { opportunityId } });
    await tx.crm_opportunity_assignee.createMany({
      data: ids.map((userId) => ({ opportunityId, userId, departmentId: opp.departmentId })),
      skipDuplicates: true,
    });
    await tx.crm_opportunity.update({
      where: { id: opportunityId },
      data: { salesPersonId: primaryId, departmentId: opp.departmentId },
    });

    if (opp.customer) {
      const cid = opp.customer.id;
      await tx.crm_customer_assignee.deleteMany({ where: { customerId: cid } });
      await tx.crm_customer_assignee.createMany({
        data: ids.map((userId) => ({ customerId: cid, userId, departmentId: opp.departmentId })),
        skipDuplicates: true,
      });
      await tx.crm_customer.update({
        where: { id: cid },
        data: { salesPersonId: primaryId, departmentId: opp.departmentId },
      });
    }
  });
}

/** 无关联线索的商机：在现有负责人基础上追加一人（并同步到关联客户） */
async function addOppCustomerAssigneeWithoutLead(
  opportunityId: string,
  userId: string
) {
  const existing = await prisma.crm_opportunity_assignee.findMany({
    where: { opportunityId },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  const ordered = existing.map((e) => e.userId);
  if (ordered.includes(userId)) {
    await syncOppCustomerAssigneesWithoutLead(opportunityId, ordered);
    return;
  }
  await syncOppCustomerAssigneesWithoutLead(opportunityId, [...ordered, userId]);
}

/** 设置线索负责人列表（全量覆盖，并同步下游商机/客户） */
export async function setLeadAssignees(leadId: string, userIds: string[]) {
  await syncDealSalesAssignees(leadId, userIds);
}

/** 批量给多条线索「追加」同一个负责人，并同步各条关联的商机/客户 */
export async function addLeadAssigneeBatch(leadIds: string[], userId: string) {
  if (!leadIds?.length || !userId) return;
  for (const leadId of leadIds) {
    const existing = await prisma.crm_lead_assignee.findMany({
      where: { leadId },
      orderBy: { createdAt: "asc" },
      select: { userId: true },
    });
    const ordered = existing.map((e) => e.userId);
    if (ordered.includes(userId)) {
      await syncDealSalesAssignees(leadId, ordered);
      continue;
    }
    await syncDealSalesAssignees(leadId, [...ordered, userId]);
  }
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
/** 商机管理表支持的排序字段 */
export const OPPORTUNITY_SORT_FIELDS = ["name", "createdAt", "productType", "status", "expectedCloseDate", "amount"] as const;

export type GetOpportunitiesOptions = {
  page?: number;
  pageSize?: number;
  leadId?: string;
  sortBy?: (typeof OPPORTUNITY_SORT_FIELDS)[number];
  sortOrder?: "asc" | "desc";
};

/** getOpportunities 返回的商机项类型（含 lead、customer、salesPerson、deliveryPerson、assignees，amount 为 number） */
export type OpportunityListItem = Omit<
  Prisma.crm_opportunityGetPayload<{
    include: {
      lead: { select: { id: true; customerName: true; contactPhone: true } };
      salesPerson: { select: { id: true; name: true } };
      deliveryPerson: { select: { id: true; name: true } };
      customer: { select: { id: true; name: true } };
      assignees: { include: { user: { select: { id: true; name: true } } } };
    };
  }>,
  "amount"
> & { amount: number | null };

export async function getOpportunities(
  auth: CrmAuth,
  options: GetOpportunitiesOptions = {}
): Promise<{ items: OpportunityListItem[]; total: number }> {
  const { page, pageSize, leadId, sortBy, sortOrder } = options;
  let where: Prisma.crm_opportunityWhereInput = opportunityScopeWhere(auth);
  if (leadId) {
    where = { ...where, leadId };
  }
  const validSortBy = sortBy && OPPORTUNITY_SORT_FIELDS.includes(sortBy) ? sortBy : "createdAt";
  const order = sortOrder === "asc" ? "asc" : "desc";
  const orderBy: Prisma.crm_opportunityOrderByWithRelationInput[] = [
    { isKeyFocus: "desc" as const },
    { [validSortBy]: order } as Prisma.crm_opportunityOrderByWithRelationInput,
    { createdAt: "desc" as const },
  ];
  const include = {
    lead: { select: { id: true, customerName: true, contactPhone: true } },
    salesPerson: { select: { id: true, name: true } },
    deliveryPerson: { select: { id: true, name: true } },
    customer: { select: { id: true, name: true } },
    assignees: {
      orderBy: { createdAt: "asc" as const },
      include: { user: { select: { id: true, name: true } } },
    },
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

/** 计算某条商机在当前列表（含 leadId 筛选、排序）下位于第几页。仅默认排序（createdAt 降序）时支持定位 */
export async function getPageForOpportunityId(
  auth: CrmAuth,
  opportunityId: string,
  pageSize: number,
  leadId?: string,
  sortBy?: (typeof OPPORTUNITY_SORT_FIELDS)[number],
  sortOrder?: "asc" | "desc"
): Promise<number> {
  if (sortBy !== "createdAt" && sortBy !== undefined) return 1;
  if (sortOrder === "asc") return 1;
  let where: Prisma.crm_opportunityWhereInput = opportunityScopeWhere(auth);
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
  const auth = await getCrmAuth();
  if (!auth?.departmentId) throw new Error("当前账号未绑定部门，无法创建商机");
  // 如果提供了 leadId，从线索继承 contactPhone、isKeyFocus、keyFocusByAdmin
  let contactPhone = data.contactPhone;
  let isKeyFocus = data.isKeyFocus;
  let keyFocusByAdmin = data.keyFocusByAdmin;
  if (data.leadId) {
    const lead = await prisma.crm_lead.findUnique({
      where: { id: data.leadId },
      select: { contactPhone: true, isKeyFocus: true, keyFocusByAdmin: true, departmentId: true },
    }) as {
      contactPhone?: string | null;
      isKeyFocus?: boolean;
      keyFocusByAdmin?: boolean;
      departmentId?: string | null;
    } | null;
    if (lead?.departmentId && lead.departmentId !== auth.departmentId) {
      throw new Error("无权跨部门创建商机");
    }
    if (contactPhone == null) contactPhone = lead?.contactPhone ?? undefined;
    if (isKeyFocus == null) isKeyFocus = lead?.isKeyFocus ?? false;
    if (keyFocusByAdmin == null) keyFocusByAdmin = lead?.keyFocusByAdmin ?? false;
  }

  const opportunity = await prisma.crm_opportunity.create({
    data: {
      departmentId: auth.departmentId,
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

  if (data.leadId) {
    const leadRows = await prisma.crm_lead_assignee.findMany({
      where: { leadId: data.leadId },
      orderBy: { createdAt: "asc" },
      select: { userId: true },
    });
    let assigneeIds = leadRows.map((r) => r.userId);
    if (assigneeIds.length === 0 && data.salesPersonId) {
      assigneeIds = [data.salesPersonId];
    }
    if (assigneeIds.length > 0) {
      await assertUsersInDepartment(prisma, assigneeIds, auth.departmentId);
      await prisma.$transaction(async (tx) => {
        await tx.crm_opportunity_assignee.deleteMany({ where: { opportunityId: opportunity.id } });
        await tx.crm_opportunity_assignee.createMany({
          data: assigneeIds.map((userId) => ({
            opportunityId: opportunity.id,
            userId,
            departmentId: auth.departmentId!,
          })),
          skipDuplicates: true,
        });
        await tx.crm_opportunity.update({
          where: { id: opportunity.id },
          data: { salesPersonId: assigneeIds[0]! },
        });
      });
    }
  } else if (data.salesPersonId) {
    await assertUsersInDepartment(prisma, [data.salesPersonId], auth.departmentId);
    await prisma.crm_opportunity_assignee.create({
      data: {
        opportunityId: opportunity.id,
        userId: data.salesPersonId,
        departmentId: auth.departmentId,
      },
    });
  }

  return opportunity;
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
  if (data.salesPersonId) {
    const opp = await prisma.crm_opportunity.findUnique({
      where: { id },
      select: { departmentId: true },
    });
    if (!opp) throw new Error("商机不存在");
    await assertUsersInDepartment(prisma, [data.salesPersonId], opp.departmentId);
  }
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
export type GetCustomersOptions = {
  page?: number;
  pageSize?: number;
  /** 按状态筛选：预备签约 | 已签约 | 流失 */
  statusFilter?: string;
  /** 排序字段：signedAt | createdAt | firstMaintenanceDate | name */
  sortBy?: string;
  /** 排序方向 */
  sortOrder?: "asc" | "desc";
};

/** getCustomers 返回的客户项类型（含 opportunity.lead.customerTier 用于展示客户分层，actualAmount 为 number） */
export type CustomerListItem = Omit<
  Prisma.crm_customerGetPayload<{
    include: {
      opportunity: { select: { id: true; name: true; lead: { select: { id: true; contactPhone: true; customerTier: true } } } };
      salesPerson: { select: { id: true; name: true } };
      assignees: { include: { user: { select: { id: true; name: true } } } };
    };
  }>,
  "actualAmount"
> & { actualAmount: number | null };

export async function getCustomers(
  auth: CrmAuth,
  options: GetCustomersOptions = {}
): Promise<{ items: CustomerListItem[]; total: number }> {
  const { page, pageSize, statusFilter, sortBy = "createdAt", sortOrder = "desc" } = options;
  const baseWhere = customerScopeWhere(auth);
  const where = statusFilter
    ? { ...baseWhere, status: statusFilter }
    : baseWhere;

  const sortField = sortBy === "signedAt" || sortBy === "createdAt" || sortBy === "firstMaintenanceDate" || sortBy === "name"
    ? sortBy
    : "createdAt";
  const secondOrder =
    sortField === "signedAt" ? { signedAt: sortOrder } :
      sortField === "firstMaintenanceDate" ? { firstMaintenanceDate: sortOrder } :
        sortField === "name" ? { name: sortOrder } :
          { createdAt: sortOrder };
  const orderBy = [{ isKeyFocus: "desc" as const }, secondOrder];
  const include = {
    opportunity: {
      select: {
        id: true,
        name: true,
        lead: { select: { id: true, contactPhone: true, customerTier: true } },
      },
    },
    salesPerson: { select: { id: true, name: true } },
    assignees: {
      orderBy: { createdAt: "asc" as const },
      include: { user: { select: { id: true, name: true } } },
    },
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
  pageSize: number,
  options?: { statusFilter?: string }
): Promise<number> {
  const baseWhere: Prisma.crm_customerWhereInput = customerScopeWhere(auth);
  const where = options?.statusFilter ? { ...baseWhere, status: options.statusFilter } : baseWhere;
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
    signedAt?: Date | null;
    contactPhone?: string;
    salesPersonId?: string | null;
  }
) {
  if (data.salesPersonId) {
    const customer = await prisma.crm_customer.findUnique({
      where: { id },
      select: { departmentId: true },
    });
    if (!customer) throw new Error("客户不存在");
    await assertUsersInDepartment(prisma, [data.salesPersonId], customer.departmentId);
  }
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
      ...(data.signedAt !== undefined && { signedAt: data.signedAt }),
      ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
      ...(data.salesPersonId !== undefined && { salesPersonId: data.salesPersonId }),
    },
  });
}

/** 批量给客户追加负责人（在现有线索/商机/客户 assignee 基础上追加，不覆盖原有多负责人） */
export async function updateCustomerSalesPersonBatch(
  customerIds: string[],
  salesPersonId: string | null
) {
  if (customerIds.length === 0) return;
  if (!salesPersonId) throw new Error(CRM_ASSIGNEE_MIN_ONE_ERROR);

  for (const customerId of customerIds) {
    const c = await prisma.crm_customer.findUnique({
      where: { id: customerId },
      select: {
        opportunity: { select: { id: true, leadId: true } },
      },
    });
    if (!c?.opportunity) {
      await prisma.$transaction(async (tx) => {
        const customerRow = await tx.crm_customer.findUnique({
          where: { id: customerId },
          select: { departmentId: true },
        });
        if (!customerRow) throw new Error("客户不存在");
        await assertUsersInDepartment(tx, [salesPersonId], customerRow.departmentId);
        const dup = await tx.crm_customer_assignee.findUnique({
          where: {
            customerId_userId: { customerId, userId: salesPersonId },
          },
        });
        if (dup) return;
        const beforeCount = await tx.crm_customer_assignee.count({ where: { customerId } });
        await tx.crm_customer_assignee.create({
          data: { customerId, userId: salesPersonId, departmentId: customerRow.departmentId },
        });
        if (beforeCount === 0) {
          await tx.crm_customer.update({
            where: { id: customerId },
            data: { salesPersonId },
          });
        }
      });
      continue;
    }
    if (c.opportunity.leadId) {
      await addLeadAssigneeBatch([c.opportunity.leadId], salesPersonId);
    } else {
      await addOppCustomerAssigneeWithoutLead(c.opportunity.id, salesPersonId);
    }
  }
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
  if (auth && !auth.departmentId) return { items: [], total: 0 };
  let where: Record<string, unknown> = filters ?? {};
  if (!auth) {
    where = { ...where, id: "00000000-0000-0000-0000-000000000000" };
  } else if (auth.role === "sales" && auth.userId) {
    where = {
      ...where,
      AND: [
        {
          OR: [
            { followUpBy: { departmentId: auth.departmentId } },
            { lead: { departmentId: auth.departmentId } },
            { customer: { departmentId: auth.departmentId } },
            { opportunity: { departmentId: auth.departmentId } },
          ],
        },
        {
          OR: [
            { followUpById: auth.userId },
            { lead: { assignees: { some: { userId: auth.userId } } } },
            {
              customer: {
                OR: [
                  { salesPersonId: auth.userId },
                  { assignees: { some: { userId: auth.userId } } },
                ],
              },
            },
            {
              opportunity: {
                OR: [
                  { salesPersonId: auth.userId },
                  { assignees: { some: { userId: auth.userId } } },
                ],
              },
            },
          ],
        },
      ],
    };
  } else {
    where = {
      ...where,
      OR: [
        { followUpBy: { departmentId: auth.departmentId } },
        { lead: { departmentId: auth.departmentId } },
        { customer: { departmentId: auth.departmentId } },
        { opportunity: { departmentId: auth.departmentId } },
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
  if (auth && !auth.departmentId) return [];
  if (!filters.leadId && !filters.customerId && !filters.opportunityId) {
    throw new Error("必须提供 leadId、customerId 或 opportunityId 之一");
  }

  let contentWhere: Record<string, unknown> = {};
  if (filters.leadId) {
    // 查找线索关联的商机
    const lead = await prisma.crm_lead.findUnique({
      where: { id: filters.leadId },
      select: { opportunity: { select: { id: true } } },
    });
    if (lead?.opportunity?.id) {
      contentWhere.OR = [
        { leadId: filters.leadId },
        { opportunityId: lead.opportunity.id },
      ];
    } else {
      contentWhere.leadId = filters.leadId;
    }
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
            { followUpBy: { departmentId: auth.departmentId } },
            { lead: { departmentId: auth.departmentId } },
            { customer: { departmentId: auth.departmentId } },
            { opportunity: { departmentId: auth.departmentId } },
          ],
        },
        {
          OR: [
            { lead: { assignees: { some: { userId: auth.userId } } } },
            {
              customer: {
                OR: [
                  { salesPersonId: auth.userId },
                  { assignees: { some: { userId: auth.userId } } },
                ],
              },
            },
            {
              opportunity: {
                OR: [
                  { salesPersonId: auth.userId },
                  { assignees: { some: { userId: auth.userId } } },
                ],
              },
            },
          ],
        },
      ],
    };
  } else {
    where = {
      AND: [
        contentWhere,
        {
          OR: [
            { followUpBy: { departmentId: auth.departmentId } },
            { lead: { departmentId: auth.departmentId } },
            { customer: { departmentId: auth.departmentId } },
            { opportunity: { departmentId: auth.departmentId } },
          ],
        },
      ],
    };
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
      lead: {
        select: {
          departmentId: true,
          assignees: { where: { userId: auth.userId }, select: { userId: true } },
        },
      },
      customer: {
        select: {
          departmentId: true,
          salesPersonId: true,
          assignees: { where: { userId: auth.userId }, select: { userId: true } },
        },
      },
      opportunity: {
        select: {
          departmentId: true,
          salesPersonId: true,
          assignees: { where: { userId: auth.userId }, select: { userId: true } },
        },
      },
    },
  });
  if (!row) return null;
  if (
    auth.departmentId &&
    row.lead?.departmentId !== auth.departmentId &&
    row.customer?.departmentId !== auth.departmentId &&
    row.opportunity?.departmentId !== auth.departmentId
  ) {
    return null;
  }
  if (auth.role === "admin") return row;
  if (row.followUpById === auth.userId) return row;
  if (row.lead?.assignees?.length) return row;
  if (row.customer?.salesPersonId === auth.userId) return row;
  if (row.customer?.assignees?.length) return row;
  if (row.opportunity?.salesPersonId === auth.userId) return row;
  if (row.opportunity?.assignees?.length) return row;
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
        select: { userId: true },
      },
    },
  });
  if (!lead) throw new Error("线索不存在或已被删除");
  if (lead.status !== "有意向") throw new Error("仅当线索状态为「有意向」时可转入商机");

  const existing = await prisma.crm_opportunity.findUnique({ where: { leadId } });
  if (existing) throw new Error("该线索已转入商机");

  const assigneeUserIds = lead.assignees.map((a) => a.userId);
  if (assigneeUserIds.length === 0) {
    throw new Error("请在线索上指定至少一位负责人后再转入商机");
  }

  const leadRow = lead as { isKeyFocus?: boolean; keyFocusByAdmin?: boolean };
  const primaryAssigneeId = assigneeUserIds[0] ?? null;
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
      assignees: {
        create: assigneeUserIds.map((userId) => ({ userId })),
      },
    },
  });

  return opportunity;
}

/** 商机转客户：当状态变为「待签约」或「已赢单」时调用，继承来源线索的字段 */
export async function opportunityToCustomer(opportunityId: string) {
  const opp = await prisma.crm_opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      customer: true,
      lead: true,
      assignees: { orderBy: { createdAt: "asc" }, select: { userId: true } },
    },
  });
  if (!opp) throw new Error("商机不存在");
  if (!["待签约", "已赢单"].includes(opp.status)) {
    throw new Error("仅当商机状态为「待签约」或「已赢单」时可转入客户");
  }
  if (opp.customer) throw new Error("该商机已转入客户");

  const lead = opp.lead;
  // 继承联系方式：优先使用商机的 contactPhone，否则使用线索的 contactPhone
  const contactPhone = opp.contactPhone ?? lead?.contactPhone ?? null;

  let assigneeUserIds = opp.assignees.map((a) => a.userId);
  if (assigneeUserIds.length === 0 && opp.salesPersonId) {
    assigneeUserIds = [opp.salesPersonId];
  }
  if (assigneeUserIds.length === 0) {
    throw new Error("请先在商机上维护至少一位销售负责人后再转入客户");
  }

  const oppRow = opp as { isKeyFocus?: boolean; keyFocusByAdmin?: boolean };
  const isSigned = opp.status === "已赢单";
  const primaryId = assigneeUserIds[0]!;
  const customer = await prisma.crm_customer.create({
    data: {
      departmentId: opp.departmentId,
      name: lead?.customerName ?? opp.name,
      nickname: lead?.nickname ?? null,
      city: lead?.city ?? null,
      industry: lead?.industry ?? null,
      opportunityId: opp.id,
      salesPersonId: primaryId,
      status: isSigned ? "已签约" : "预备签约",
      signedAt: isSigned ? new Date() : null,
      contactPhone,
      isKeyFocus: oppRow.isKeyFocus ?? false,
      keyFocusByAdmin: oppRow.keyFocusByAdmin ?? false,
      assignees: {
        create: assigneeUserIds.map((userId) => ({
          userId,
          departmentId: opp.departmentId,
        })),
      },
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
  if (!auth || !auth.departmentId) return [];

  // 查询未通知的记录
  const where =
    auth.role === "admin"
      ? { notified: false, lead: { departmentId: auth.departmentId } }
      : {
        notified: false,
        lead: { departmentId: auth.departmentId },
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
  if (!auth || !auth.departmentId) return [];

  const where =
    auth.role === "admin"
      ? { lead: { departmentId: auth.departmentId } }
      : {
        lead: { departmentId: auth.departmentId },
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

/** 全局搜索：线索、商机、客户、待签约、本月计划、跟进（遵守 CRM 权限），分栏展示，每表单独分页 */
export type GlobalSearchItem = {
  type: "lead" | "opportunity" | "customer" | "pendingCustomer" | "monthlyPlan" | "followUp";
  id: string;
  title: string;
  subtitle?: string;
  createdAt: Date;
  /** 跟进记录点击跳转时用于筛选（leadId/customerId/opportunityId 取其一） */
  leadId?: string;
  customerId?: string;
  opportunityId?: string;
};

export type GlobalSearchResult = {
  leads: { items: GlobalSearchItem[]; total: number };
  opportunities: { items: GlobalSearchItem[]; total: number };
  customers: { items: GlobalSearchItem[]; total: number };
  pendingCustomers: { items: GlobalSearchItem[]; total: number };
  monthlyPlans: { items: GlobalSearchItem[]; total: number };
  followUps: { items: GlobalSearchItem[]; total: number };
};

const SEARCH_PAGE_SIZE = 5;

export async function globalSearchCrm(
  auth: CrmAuth,
  keyword: string,
  leadPage: number,
  oppPage: number,
  customerPage: number,
  pendingCustomerPage: number,
  monthlyPlanPage: number,
  followUpPage: number
): Promise<GlobalSearchResult> {
  const k = keyword?.trim();
  const empty = { items: [] as GlobalSearchItem[], total: 0 };
  if (!auth || !k) {
    return {
      leads: empty,
      opportunities: empty,
      customers: empty,
      pendingCustomers: empty,
      monthlyPlans: empty,
      followUps: empty,
    };
  }
  if (!auth.departmentId) {
    return {
      leads: empty,
      opportunities: empty,
      customers: empty,
      pendingCustomers: empty,
      monthlyPlans: empty,
      followUps: empty,
    };
  }

  const oppAuthWhere = opportunityScopeWhere(auth);
  const custAuthWhere = customerScopeWhere(auth);
  const leadBase = buildLeadWhere(auth);
  const planMonth = getCurrentPlanMonth();

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
    {
      assignees: {
        some: { user: { name: { contains: k, mode: "insensitive" as const } } },
      },
    },
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
    {
      assignees: {
        some: { user: { name: { contains: k, mode: "insensitive" as const } } },
      },
    },
  ];

  const leadWhere = { ...leadBase, OR: orLead };
  const oppWhere: Prisma.crm_opportunityWhereInput =
    { AND: [oppAuthWhere, { OR: orOpp }] };
  const customerWhere: Prisma.crm_customerWhereInput =
    { AND: [custAuthWhere, { OR: orCustomer }] };
  const pendingCustomerWhere: Prisma.crm_customerWhereInput =
    { AND: [custAuthWhere, { status: "预备签约" as const, OR: orCustomer }] };

  const mpBaseWhere: Prisma.crm_monthly_plan_leadWhereInput = {
    planMonth,
    user: { departmentId: auth.departmentId },
    ...(auth.role === "sales" && auth.userId ? { userId: auth.userId } : {}),
  };
  const mpLeadWhere = { ...leadBase, OR: orLead };
  const monthlyPlanWhere = {
    ...mpBaseWhere,
    lead: mpLeadWhere,
  };

  const followUpAuthWhere: Prisma.crm_follow_upWhereInput =
    auth.role === "sales" && auth.userId
      ? {
        AND: [
          {
            OR: [
              { followUpBy: { departmentId: auth.departmentId } },
              { lead: { departmentId: auth.departmentId } },
              { customer: { departmentId: auth.departmentId } },
              { opportunity: { departmentId: auth.departmentId } },
            ],
          },
          {
            OR: [
              { followUpById: auth.userId },
              { lead: { assignees: { some: { userId: auth.userId } } } },
              {
                customer: {
                  OR: [
                    { salesPersonId: auth.userId },
                    { assignees: { some: { userId: auth.userId } } },
                  ],
                },
              },
              {
                opportunity: {
                  OR: [
                    { salesPersonId: auth.userId },
                    { assignees: { some: { userId: auth.userId } } },
                  ],
                },
              },
            ],
          },
        ],
      }
      : {
        OR: [
          { followUpBy: { departmentId: auth.departmentId } },
          { lead: { departmentId: auth.departmentId } },
          { customer: { departmentId: auth.departmentId } },
          { opportunity: { departmentId: auth.departmentId } },
        ],
      };
  const orFollowUp = [
    { content: { contains: k, mode: "insensitive" as const } },
    { summary: { contains: k, mode: "insensitive" as const } },
    { nextStep: { contains: k, mode: "insensitive" as const } },
    { customerNeeds: { contains: k, mode: "insensitive" as const } },
    { contactPerson: { contains: k, mode: "insensitive" as const } },
    { status: { contains: k, mode: "insensitive" as const } },
    { lead: { customerName: { contains: k, mode: "insensitive" as const } } },
    { customer: { name: { contains: k, mode: "insensitive" as const } } },
    { opportunity: { name: { contains: k, mode: "insensitive" as const } } },
  ];
  const followUpWhere: Prisma.crm_follow_upWhereInput =
    Object.keys(followUpAuthWhere).length > 0
      ? { AND: [followUpAuthWhere, { OR: orFollowUp }] }
      : { OR: orFollowUp };

  const [
    leadsCount,
    oppsCount,
    customersCount,
    pendingCustomersCount,
    monthlyPlansCount,
    followUpsCount,
    leads,
    opportunities,
    customers,
    pendingCustomers,
    monthlyPlanEntries,
    followUps,
  ] = await Promise.all([
    prisma.crm_lead.count({ where: leadWhere }),
    prisma.crm_opportunity.count({ where: oppWhere }),
    prisma.crm_customer.count({ where: customerWhere }),
    prisma.crm_customer.count({ where: pendingCustomerWhere }),
    prisma.crm_monthly_plan_lead.count({ where: monthlyPlanWhere }),
    prisma.crm_follow_up.count({ where: followUpWhere }),
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
    prisma.crm_customer.findMany({
      where: pendingCustomerWhere,
      orderBy: { createdAt: "desc" },
      skip: pendingCustomerPage * SEARCH_PAGE_SIZE,
      take: SEARCH_PAGE_SIZE,
      select: { id: true, name: true, contactPhone: true, createdAt: true },
    }),
    prisma.crm_monthly_plan_lead.findMany({
      where: monthlyPlanWhere,
      orderBy: { createdAt: "desc" },
      skip: monthlyPlanPage * SEARCH_PAGE_SIZE,
      take: SEARCH_PAGE_SIZE,
      select: {
        id: true,
        leadId: true,
        lead: { select: { customerName: true, contactPhone: true, createdAt: true } },
      },
    }),
    prisma.crm_follow_up.findMany({
      where: followUpWhere,
      orderBy: { followDate: "desc" },
      skip: followUpPage * SEARCH_PAGE_SIZE,
      take: SEARCH_PAGE_SIZE,
      select: {
        id: true,
        summary: true,
        content: true,
        followDate: true,
        leadId: true,
        customerId: true,
        opportunityId: true,
        lead: { select: { customerName: true } },
        customer: { select: { name: true } },
        opportunity: { select: { name: true } },
      },
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
  const pendingCustomerItems: GlobalSearchItem[] = pendingCustomers.map((c) => ({
    type: "pendingCustomer",
    id: c.id,
    title: c.name,
    subtitle: c.contactPhone ?? undefined,
    createdAt: c.createdAt,
  }));
  const monthlyPlanItems: GlobalSearchItem[] = monthlyPlanEntries.map((e) => ({
    type: "monthlyPlan",
    id: e.leadId,
    title: e.lead.customerName,
    subtitle: e.lead.contactPhone ?? undefined,
    createdAt: e.lead.createdAt,
  }));
  const followUpItems: GlobalSearchItem[] = followUps.map((f) => {
    const ctx = f.lead?.customerName ?? f.customer?.name ?? f.opportunity?.name ?? "-";
    return {
      type: "followUp" as const,
      id: f.id,
      title: (f.summary ?? f.content.slice(0, 50)) + (f.content.length > 50 ? "…" : ""),
      subtitle: ctx,
      createdAt: f.followDate,
      leadId: f.leadId ?? undefined,
      customerId: f.customerId ?? undefined,
      opportunityId: f.opportunityId ?? undefined,
    };
  });

  return {
    leads: { items: leadItems, total: leadsCount },
    opportunities: { items: oppItems, total: oppsCount },
    customers: { items: customerItems, total: customersCount },
    pendingCustomers: { items: pendingCustomerItems, total: pendingCustomersCount },
    monthlyPlans: { items: monthlyPlanItems, total: monthlyPlansCount },
    followUps: { items: followUpItems, total: followUpsCount },
  };
}

// ============ 跟进汇报（原「本周跟进」，仅部分部门使用）============

/** 本地日历周：周一 00:00 至下周一 00:00（不含） */
function getLocalCalendarWeekBounds(): { weekStart: Date; weekEndExclusive: Date } {
  const now = new Date();
  const dow = now.getDay();
  const offsetMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetMonday, 0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return { weekStart: monday, weekEndExclusive: nextMonday };
}

const weeklyProgressLeadInclude = {
  assignees: {
    orderBy: { createdAt: "asc" as const },
    include: { user: { select: { id: true, name: true } } },
  },
  opportunity: {
    select: { id: true, name: true, customer: { select: { id: true, status: true } } },
  },
  followUps: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      id: true,
      summary: true,
      content: true,
      followDate: true,
      createdAt: true,
      updatedAt: true,
      contactPerson: true,
      nextStep: true,
      customerNeeds: true,
      status: true,
      isSystemGenerated: true,
      followUpBy: { select: { name: true } },
    },
  },
} satisfies Prisma.crm_leadInclude;

export type WeeklyProgressLeadItem = Prisma.crm_leadGetPayload<{
  include: typeof weeklyProgressLeadInclude;
}>;

export type WeeklyProgressTimeWindow = {
  start: Date;
  endExclusive: Date;
};

function resolveWeeklyProgressTimeWindow(window?: WeeklyProgressTimeWindow): WeeklyProgressTimeWindow {
  if (window?.start && window?.endExclusive && window.start < window.endExclusive) {
    return window;
  }
  const { weekStart, weekEndExclusive } = getLocalCalendarWeekBounds();
  return { start: weekStart, endExclusive: weekEndExclusive };
}

function buildWeeklyProgressFollowUpWhere(window?: WeeklyProgressTimeWindow): Prisma.crm_follow_upWhereInput {
  const resolved = resolveWeeklyProgressTimeWindow(window);
  return {
    OR: [
      { followDate: { gte: resolved.start, lt: resolved.endExclusive } },
      { createdAt: { gte: resolved.start, lt: resolved.endExclusive } },
    ],
  };
}

/** 跟进汇报页：单条跟进展示（含录入人） */
export type WeeklyProgressFollowUpRow = {
  id: string;
  leadId: string;
  summary: string | null;
  content: string;
  followDate: Date;
  createdAt: Date;
  authorName: string;
};

async function fetchFollowUpsByLeadIdInWindow(
  auth: CrmAuth,
  leadIds: string[],
  window?: WeeklyProgressTimeWindow
): Promise<Record<string, WeeklyProgressFollowUpRow[]>> {
  const empty: Record<string, WeeklyProgressFollowUpRow[]> = {};
  if (!auth || leadIds.length === 0) return empty;
  const resolved = resolveWeeklyProgressTimeWindow(window);
  const rows = await prisma.crm_follow_up.findMany({
    where: {
      leadId: { in: leadIds },
      OR: [
        { followDate: { gte: resolved.start, lt: resolved.endExclusive } },
        { createdAt: { gte: resolved.start, lt: resolved.endExclusive } },
      ],
      lead: { is: buildLeadWhere(auth, false) },
    },
    // 本周时间线：按录入时间从新到旧（与「最新跟进」语义一致）
    orderBy: [{ createdAt: "desc" as const }, { followDate: "desc" as const }],
    select: {
      id: true,
      leadId: true,
      summary: true,
      content: true,
      followDate: true,
      createdAt: true,
      followUpBy: { select: { name: true } },
    },
  });

  const map: Record<string, WeeklyProgressFollowUpRow[]> = {};
  for (const r of rows) {
    if (!r.leadId) continue;
    const authorName = r.followUpBy?.name?.trim() || "—";
    const item: WeeklyProgressFollowUpRow = {
      id: r.id,
      leadId: r.leadId,
      summary: r.summary,
      content: r.content,
      followDate: r.followDate,
      createdAt: r.createdAt,
      authorName,
    };
    if (!map[r.leadId]) map[r.leadId] = [];
    map[r.leadId].push(item);
  }
  return map;
}

/** 列表：与线索管理相同权限范围，附带最新一条跟进；并返回各线索在指定时间范围内的全部跟进 */
export async function getLeadsForWeeklyProgress(
  auth: CrmAuth,
  options: { weekOnly: boolean; window?: WeeklyProgressTimeWindow }
): Promise<{
  items: WeeklyProgressLeadItem[];
  total: number;
  followUpsThisWeekByLeadId: Record<string, WeeklyProgressFollowUpRow[]>;
}> {
  const baseWhere = buildLeadWhere(auth, false);
  const weekFollowWhere = buildWeeklyProgressFollowUpWhere(options.window);
  const where: Prisma.crm_leadWhereInput = options.weekOnly
    ? {
        ...baseWhere,
        followUps: { some: { ...weekFollowWhere } },
      }
    : baseWhere;

  const orderBy: Prisma.crm_leadOrderByWithRelationInput[] = [
    { isKeyFocus: "desc" as const },
    { createdAt: "desc" as const },
  ];

  const [items, total] = await Promise.all([
    prisma.crm_lead.findMany({
      where,
      orderBy,
      include: weeklyProgressLeadInclude,
    }),
    prisma.crm_lead.count({ where }),
  ]);

  const typed = items as WeeklyProgressLeadItem[];
  const leadIds = typed.map((l) => l.id);
  const followUpsThisWeekByLeadId = await fetchFollowUpsByLeadIdInWindow(auth, leadIds, options.window);

  return { items: typed, total, followUpsThisWeekByLeadId };
}

/** 顶部统计：线索合计、有跟进线索数、跟进条数（权限范围内，随所选时间窗口变化） */
export async function getWeeklyProgressStats(
  auth: CrmAuth,
  window?: WeeklyProgressTimeWindow
): Promise<{
  leadTotal: number;
  leadsWithFollowUpThisWeek: number;
  followUpsThisWeekCount: number;
}> {
  const baseWhere = buildLeadWhere(auth, false);
  const weekFollowWhere = buildWeeklyProgressFollowUpWhere(window);
  const resolved = resolveWeeklyProgressTimeWindow(window);
  const [leadTotal, leadsWithFollowUpThisWeek, followUpsThisWeekCount] = await Promise.all([
    prisma.crm_lead.count({ where: baseWhere }),
    prisma.crm_lead.count({
      where: {
        ...baseWhere,
        followUps: { some: { ...weekFollowWhere } },
      },
    }),
    prisma.crm_follow_up.count({
      where: {
        leadId: { not: null },
        OR: [
          { followDate: { gte: resolved.start, lt: resolved.endExclusive } },
          { createdAt: { gte: resolved.start, lt: resolved.endExclusive } },
        ],
        lead: { is: baseWhere },
      },
    }),
  ]);
  return { leadTotal, leadsWithFollowUpThisWeek, followUpsThisWeekCount };
}

/** 侧栏「搜索线索写跟进」：轻量线索列表（搜索客户名/简称/商机名） */
export type CatchUpLeadRow = {
  id: string;
  customerName: string;
  nickname: string | null;
  opportunityName: string | null;
};

export async function getLeadsForCatchUpList(
  auth: CrmAuth,
  options: { search?: string; take?: number } = {}
): Promise<CatchUpLeadRow[]> {
  if (!auth?.departmentId) return [];
  const take = Math.min(100, Math.max(1, options.take ?? 60));
  const kw = options.search?.trim() ?? "";
  const base = buildLeadWhere(auth, false);
  const where: Prisma.crm_leadWhereInput =
    kw.length > 0
      ? {
          ...base,
          OR: [
            { customerName: { contains: kw, mode: "insensitive" as const } },
            { nickname: { contains: kw, mode: "insensitive" as const } },
            { opportunity: { is: { name: { contains: kw, mode: "insensitive" as const } } } },
          ],
        }
      : base;

  const rows = await prisma.crm_lead.findMany({
    where,
    select: {
      id: true,
      customerName: true,
      nickname: true,
      opportunity: { select: { name: true } },
    },
    orderBy: [{ isKeyFocus: "desc" as const }, { createdAt: "desc" as const }],
    take,
  });

  return rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    nickname: r.nickname,
    opportunityName: r.opportunity?.name?.trim() || null,
  }));
}
