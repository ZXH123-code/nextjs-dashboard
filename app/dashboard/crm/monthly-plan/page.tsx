import { getCrmAuth, getMonthlyPlanLeads, getMonthlyPlanStats, getMonthlyPlanStatsByUser, MONTHLY_PLAN_SORT_FIELDS } from "@/app/lib/crm";
import type { LeadFilter } from "@/app/lib/crm";
import { MonthlyPlanTable } from "./MonthlyPlanTable";
import { Pagination } from "@/components/ui/pagination";
import { lusitana } from "@/app/ui/fonts";
import { Card } from "@/app/ui/dashboard/cards";

type SearchParams = { page?: string; pageSize?: string; filter?: string; sortBy?: string; sortOrder?: string };

function decodeFilter(filterStr: string | undefined): LeadFilter | undefined {
  if (!filterStr?.trim()) return undefined;
  try {
    const decoded = decodeURIComponent(filterStr);
    const parsed = JSON.parse(decoded) as LeadFilter;
    if (!parsed?.groups) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export default async function MonthlyPlanPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(params.pageSize ?? "20", 10) || 20));
  const filter = decodeFilter(params.filter);
  const sortBy = params.sortBy && MONTHLY_PLAN_SORT_FIELDS.includes(params.sortBy as (typeof MONTHLY_PLAN_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof MONTHLY_PLAN_SORT_FIELDS)[number])
    : "createdAt";
  const sortOrder = params.sortOrder === "asc" ? "asc" : "desc";

  const auth = await getCrmAuth();
  if (!auth) return null;

  let items: Awaited<ReturnType<typeof getMonthlyPlanLeads>>["items"] = [];
  let total = 0;
  let stats = { total: 0, contacted: 0, opportunityCount: 0, customerCount: 0 };
  let statsByUser: Awaited<ReturnType<typeof getMonthlyPlanStatsByUser>> = [];

  try {
    const [leadsRes, statsRes, statsByUserRes] = await Promise.all([
      getMonthlyPlanLeads(auth, { page, pageSize, filter, sortBy, sortOrder }),
      getMonthlyPlanStats(auth),
      getMonthlyPlanStatsByUser(auth),
    ]);
    items = leadsRes.items;
    total = leadsRes.total;
    stats = statsRes;
    statsByUser = statsByUserRes;
  } catch (e) {
    console.error("获取本月计划失败:", e);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const planMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  return (
    <main className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>
          本月计划（{planMonth}）
        </h1>
      </div>

      {/* 指标卡片 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="本月计划线索" value={stats.total} type="leads" />
        <Card title="已联系" value={stats.contacted} type="opportunities" />
        <Card title="转化商机" value={stats.opportunityCount} type="opportunities" />
        <Card title="转化客户" value={stats.customerCount} type="customers" />
      </div>

      {/* 管理员：人员下拉 + 表格汇总 */}
      {auth.role === "admin" && (
        <div className="mb-6 space-y-4">
          <MonthlyPlanTable
            items={items}
            total={total}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            statsByUser={statsByUser}
            isAdmin={true}
            currentUserRole={auth.role}
            currentUserId={auth.userId ?? undefined}
            initialFilter={filter}
            filterParam={params.filter}
            sortBy={sortBy}
            sortOrder={sortOrder}
          />
        </div>
      )}

      {auth.role !== "admin" && (
        <div className="mb-6">
          <MonthlyPlanTable
            items={items}
            total={total}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            statsByUser={[]}
            isAdmin={false}
            currentUserRole={auth.role}
            currentUserId={auth.userId ?? undefined}
            initialFilter={filter}
            filterParam={params.filter}
            sortBy={sortBy}
            sortOrder={sortOrder}
          />
        </div>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        本月计划中的线索来自线索管理表：管理员可通过右键「分配至本月计划」指定跟进人；普通销售也可将自己负责的线索纳入「我的本月计划」。销售仅能看到自己的本月计划。
      </p>
    </main>
  );
}
