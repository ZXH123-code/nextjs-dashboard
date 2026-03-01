import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getLeads, getCrmAuth, getUsers, getPageForLeadId } from "@/app/lib/crm";
import type { LeadFilter } from "@/app/lib/crm";
import { LeadsTableWithBulk } from "./LeadsTableWithBulk";
import { LeadsPageActions } from "./LeadsPageActions";
import { LeadsTableSkeleton } from "./LeadsTableSkeleton";
import { Pagination } from "@/components/ui/pagination";
import { lusitana } from "@/app/ui/fonts";

type SearchParams = { highlight?: string; page?: string; pageSize?: string; filter?: string };

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
  const pageSize = Math.max(1, Math.min(100, parseInt(params.pageSize ?? "20", 10) || 20));
  const filter = decodeFilter(params.filter);

  let leads: Awaited<ReturnType<typeof getLeads>>["items"] = [];
  let total = 0;
  let users: Awaited<ReturnType<typeof getUsers>> = [];

  try {
    const [leadsRes, usersList] = await Promise.all([
      getLeads(auth, { page, pageSize, filter }),
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
      />
      <Pagination
        basePath="/dashboard/crm/leads"
        currentPage={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        preserveParams={{ highlight: params.highlight, filter: params.filter }}
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
  const pageSize = Math.max(1, Math.min(100, parseInt(params.pageSize ?? "20", 10) || 20));
  const filter = decodeFilter(params.filter);

  // 搜索点击跳转：若高亮记录不在当前页，先重定向到所在页；若高亮记录已删除则清除 highlight 避免无法翻页
  if (params.highlight?.trim()) {
    const targetPage = await getPageForLeadId(auth, params.highlight, filter, pageSize);
    if (targetPage === null) {
      // 线索已删除或不存在，清除 highlight 避免每次翻页都被重定向回第 1 页
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("pageSize", String(pageSize));
      if (params.filter) q.set("filter", params.filter);
      redirect(`/dashboard/crm/leads?${q.toString()}`);
    }
    if (targetPage !== page) {
      // URL 中有 page 参数说明用户通过分页链接请求了某页，优先尊重用户选择并清除 highlight，避免卡在错误页
      const hasExplicitPage = params.page != null && params.page !== "";
      if (hasExplicitPage) {
        const q = new URLSearchParams();
        q.set("page", String(page));
        q.set("pageSize", String(pageSize));
        if (params.filter) q.set("filter", params.filter);
        redirect(`/dashboard/crm/leads?${q.toString()}`);
      }
      // 来自搜索点击（无 page 参数），重定向到目标页；先验证记录是否在目标页，避免计算错误导致卡住
      const leadsRes = await getLeads(auth, { page: targetPage, pageSize, filter });
      const leadInPage = leadsRes.items.some((l) => l.id === params.highlight);
      const q = new URLSearchParams();
      q.set("page", String(targetPage));
      q.set("pageSize", String(pageSize));
      if (params.filter) q.set("filter", params.filter);
      if (leadInPage) q.set("highlight", params.highlight);
      redirect(`/dashboard/crm/leads?${q.toString()}`);
    }
  }

  const suspenseKey = `${params.page ?? "1"}-${params.pageSize ?? "20"}-${params.filter ?? ""}`;

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
