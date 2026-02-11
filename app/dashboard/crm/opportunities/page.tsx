import { getOpportunities, getCrmAuth, getUsers } from "@/app/lib/crm";
import { OpportunitiesTable } from "./OpportunitiesTable";
import Link from "next/link";
import { lusitana } from "@/app/ui/fonts";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";

type SearchParams = { highlight?: string; leadId?: string };

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  let opportunities: Awaited<ReturnType<typeof getOpportunities>> = [];
  let users: Awaited<ReturnType<typeof getUsers>> = [];
  let currentUserRole = "sales";
  let currentUserId: string | undefined;
  try {
    const crmAuth = await getCrmAuth();
    [opportunities, users] = await Promise.all([
      getOpportunities(crmAuth),
      getUsers(),
    ]);

    const session = await auth();
    currentUserRole = (session?.user as { role?: string })?.role ?? "sales";
    currentUserId = (session?.user as { id?: string })?.id;
  } catch (e) {
    console.error("获取商机失败:", e);
  }

  // leadId：从线索详情等进入时只显示该线索下的商机；无则显示全部。highlight 仅用于表格内高亮+滚动，不筛列表
  let filteredOpps = opportunities;
  if (params.leadId && !params.highlight) {
    filteredOpps = opportunities.filter((o) => o.leadId === params.leadId);
  }

  const serializedOpps = filteredOpps.map((o) => ({
    ...o,
    amount: o.amount != null ? Number(o.amount) : null,
  }));

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>商机管理表</h1>
      </div>

      {params.leadId && !params.highlight && filteredOpps.length > 0 && (
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
        opportunities={serializedOpps}
        currentUserRole={currentUserRole}
        currentUserId={currentUserId}
        users={users}
        highlightId={params.highlight}
      />

      <p className="mt-4 text-sm text-muted-foreground">
        状态说明：将线索状态改为「有意向」后，商机会自动生成并出现在此处。初步沟通 → 方案确认 → 待签约/已赢单（可转入客户）| 已丢单
      </p>
    </main>
  );
}
