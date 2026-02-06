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
  try {
    const crmAuth = await getCrmAuth();
    [opportunities, users] = await Promise.all([
      getOpportunities(crmAuth),
      getUsers(),
    ]);
    
    const session = await auth();
    currentUserRole = (session?.user as { role?: string })?.role ?? "sales";
  } catch (e) {
    console.error("获取商机失败:", e);
  }

  // 从线索进入（highlight=商机ID）：筛选并显示来源；从侧边栏进入：显示全部
  let filterLabel: string | null = null;
  let filteredOpps = opportunities;
  if (params.highlight) {
    const target = opportunities.find((o) => o.id === params.highlight);
    if (target) {
      const leadName = target.lead?.customerName ?? "未知线索";
      filterLabel = `来源于线索「${leadName}」`;
      filteredOpps = [target];
    }
  } else if (params.leadId) {
    const fromLead = opportunities.filter((o) => o.leadId === params.leadId);
    if (fromLead.length > 0) {
      const leadName = fromLead[0]?.lead?.customerName ?? "未知线索";
      filterLabel = `来源于线索「${leadName}」`;
      filteredOpps = fromLead;
    }
  }

  // 序列化为纯对象：Prisma Decimal 不能传入 Client Component，转为 number
  const serializedOpps = filteredOpps.map((o) => ({
    ...o,
    amount: o.amount != null ? Number(o.amount) : null,
  }));

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>商机管理表</h1>
      </div>

      {filterLabel && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
          <span className="text-sm font-medium">当前筛选：{filterLabel}</span>
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
        users={users}
        highlightId={params.highlight}
      />

      <p className="mt-4 text-sm text-muted-foreground">
        状态说明：将线索状态改为「有意向」后，商机会自动生成并出现在此处。初步沟通 → 方案确认 → 待签约/已赢单（可转入客户）| 已丢单
      </p>
    </main>
  );
}
