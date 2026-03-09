import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getLeads, getCrmAuth, getUsers, getPageForLeadId, LEADS_SORT_FIELDS } from "@/app/lib/crm";
import type { LeadFilter } from "@/app/lib/crm";
import { LeadsTableWithBulk } from "./LeadsTableWithBulk";
import { LeadsPageActions } from "./LeadsPageActions";
import { LeadsTableSkeleton } from "./LeadsTableSkeleton";
import { Pagination } from "@/components/ui/pagination";
import { lusitana } from "@/app/ui/fonts";

type SearchParams = { highlight?: string; page?: string; pageSize?: string; filter?: string; sortBy?: string; sortOrder?: string };

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

async function LeadsContent({
  params,
  auth,
}: {
  params: SearchParams;
  auth: Awaited<ReturnType<typeof getCrmAuth>>;
}) {
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = Math.max(1, Math.min(400, parseInt(params.pageSize ?? "20", 10) || 20));
  const filter = decodeFilter(params.filter);
  const sortBy = params.sortBy && LEADS_SORT_FIELDS.includes(params.sortBy as (typeof LEADS_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof LEADS_SORT_FIELDS)[number])
    : "createdAt";
  const sortOrder = params.sortOrder === "asc" ? "asc" : "desc";

  let leads: Awaited<ReturnType<typeof getLeads>>["items"] = [];
  let total = 0;
  let users: Awaited<ReturnType<typeof getUsers>> = [];

  try {
    const [leadsRes, usersList] = await Promise.all([
      getLeads(auth, { page, pageSize, filter, sortBy, sortOrder }),
      getUsers(),
    ]);
    leads = leadsRes.items.map((item) => ({
      ...item,
      createdAt: item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt as unknown as string),
    }));
    total = leadsRes.total;
    users = usersList;
  } catch (e) {
    console.error("获取线索失败:", e);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isAdmin = auth?.role === "admin";

  return (
    <>
      <LeadsTableWithBulk
        leads={leads}
        users={users}
        isAdmin={isAdmin}
        currentUserRole={auth?.role}
        currentUserId={auth?.userId}
        highlightId={params.highlight}
        total={total}
        page={page}
        pageSize={pageSize}
        initialFilter={filter}
        filterParam={params.filter}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />
      <Pagination
        basePath="/dashboard/crm/leads"
        currentPage={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        preserveParams={{ highlight: params.highlight, filter: params.filter, sortBy, sortOrder }}
        showPageSizeSelector
      />
    </>
  );
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const auth = await getCrmAuth();
  const isAdmin = auth?.role === "admin";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = Math.max(1, Math.min(400, parseInt(params.pageSize ?? "20", 10) || 20));
  const filter = decodeFilter(params.filter);
  const sortBy = params.sortBy && LEADS_SORT_FIELDS.includes(params.sortBy as (typeof LEADS_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof LEADS_SORT_FIELDS)[number])
    : "createdAt";
  const sortOrder = params.sortOrder === "asc" ? "asc" : "desc";

  const appendPreserveParams = (q: URLSearchParams) => {
    if (params.filter) q.set("filter", params.filter);
    if (sortBy !== "createdAt" || sortOrder !== "desc") {
      q.set("sortBy", sortBy);
      q.set("sortOrder", sortOrder);
    }
  };

  // 搜索点击跳转：若高亮记录不在当前页，先重定向到所在页；若高亮记录已删除则清除 highlight 避免无法翻页。仅默认排序时支持定位
  if (params.highlight?.trim()) {
    const targetPage = await getPageForLeadId(auth, params.highlight, filter, pageSize, sortBy, sortOrder);
    if (targetPage === null) {
      // 线索已删除或不存在，或非默认排序无法定位，清除 highlight
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("pageSize", String(pageSize));
      appendPreserveParams(q);
      redirect(`/dashboard/crm/leads?${q.toString()}`);
    }
    if (targetPage !== page) {
      const hasExplicitPage = params.page != null && params.page !== "";
      if (hasExplicitPage) {
        const q = new URLSearchParams();
        q.set("page", String(page));
        q.set("pageSize", String(pageSize));
        appendPreserveParams(q);
        redirect(`/dashboard/crm/leads?${q.toString()}`);
      }
      const leadsRes = await getLeads(auth, { page: targetPage, pageSize, filter, sortBy, sortOrder });
      const leadInPage = leadsRes.items.some((l) => l.id === params.highlight);
      const q = new URLSearchParams();
      q.set("page", String(targetPage));
      q.set("pageSize", String(pageSize));
      appendPreserveParams(q);
      if (leadInPage) q.set("highlight", params.highlight);
      redirect(`/dashboard/crm/leads?${q.toString()}`);
    }
  }

  const suspenseKey = `${params.page ?? "1"}-${params.pageSize ?? "20"}-${params.filter ?? ""}-${params.sortBy ?? ""}-${params.sortOrder ?? ""}`;

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>线索管理表</h1>
        <LeadsPageActions isAdmin={isAdmin ?? false} />
      </div>

      <Suspense key={suspenseKey} fallback={<LeadsTableSkeleton />}>
        <LeadsContent params={params} auth={auth} />
      </Suspense>

      <p className="mt-4 text-sm text-muted-foreground">
        状态说明：未跟进 → 有意向（自动生成商机并可补全）| 无意向。点击「新建线索」可直接增加一行并行内编辑；管理员可指定负责人、批量导入及编辑全部，销售人员新建的线索默认为自己且不可改负责人。
      </p>
    </main>
  );
}
