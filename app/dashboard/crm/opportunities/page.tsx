import { getOpportunities, getCrmAuth, getUsers, getPageForOpportunityId, OPPORTUNITY_SORT_FIELDS } from "@/app/lib/crm";
import { OpportunitiesTable } from "./OpportunitiesTable";
import { Pagination } from "@/components/ui/pagination";
import Link from "next/link";
import { redirect } from "next/navigation";
import { lusitana } from "@/app/ui/fonts";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";

type SearchParams = { highlight?: string; leadId?: string; page?: string; pageSize?: string; sortBy?: string; sortOrder?: string };

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(params.pageSize ?? "20", 10) || 20));
  const sortBy = params.sortBy && OPPORTUNITY_SORT_FIELDS.includes(params.sortBy as (typeof OPPORTUNITY_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof OPPORTUNITY_SORT_FIELDS)[number])
    : "createdAt";
  const sortOrder = params.sortOrder === "asc" ? "asc" : "desc";

  const crmAuth = await getCrmAuth();

  // 搜索点击跳转：若高亮商机不在当前页，先重定向到所在页。仅默认排序时支持定位
  if (params.highlight?.trim()) {
    const targetPage = await getPageForOpportunityId(
      crmAuth,
      params.highlight,
      pageSize,
      params.leadId ?? undefined,
      sortBy,
      sortOrder
    );
    if (targetPage !== page) {
      const q = new URLSearchParams();
      q.set("page", String(targetPage));
      q.set("pageSize", String(pageSize));
      if (params.leadId) q.set("leadId", params.leadId);
      if (sortBy !== "createdAt" || sortOrder !== "desc") {
        q.set("sortBy", sortBy);
        q.set("sortOrder", sortOrder);
      }
      q.set("highlight", params.highlight);
      redirect(`/dashboard/crm/opportunities?${q.toString()}`);
    }
  }

  let opportunities: Awaited<ReturnType<typeof getOpportunities>>["items"] = [];
  let total = 0;
  let users: Awaited<ReturnType<typeof getUsers>> = [];
  let currentUserRole = "sales";
  let currentUserId: string | undefined;
  try {
    const [oppsRes, usersList] = await Promise.all([
      getOpportunities(crmAuth, {
        page,
        pageSize,
        leadId: params.leadId ?? undefined,
        sortBy,
        sortOrder,
      }),
      getUsers(),
    ]);
    opportunities = oppsRes.items;
    total = oppsRes.total;
    users = usersList;

    const session = await auth();
    currentUserRole = (session?.user as { role?: string })?.role ?? "sales";
    currentUserId = (session?.user as { id?: string })?.id;
  } catch (e) {
    console.error("获取商机失败:", e);
  }

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>商机管理表</h1>
      </div>

      {params.leadId && !params.highlight && opportunities.length > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
          <span className="text-sm font-medium">当前筛选：该线索下的商机</span>
          <Link
            href="/dashboard/crm/opportunities"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            查看全部商机
          </Link>
        </div>
      )}

      <OpportunitiesTable
        opportunities={opportunities}
        currentUserRole={currentUserRole}
        currentUserId={currentUserId}
        users={users}
        highlightId={params.highlight}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />

      <Pagination
        basePath="/dashboard/crm/opportunities"
        currentPage={page}
        totalPages={Math.ceil(total / pageSize)}
        total={total}
        pageSize={pageSize}
        preserveParams={{ highlight: params.highlight, leadId: params.leadId, sortBy, sortOrder }}
      />

      <p className="mt-4 text-sm text-muted-foreground">
        状态说明：将线索状态改为「有意向」后，商机会自动生成并出现在此处。初步沟通 → 方案确认 → 待签约/已赢单（可转入客户）| 已丢单
      </p>
    </main>
  );
}
