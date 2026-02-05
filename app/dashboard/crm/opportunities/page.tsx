import { getOpportunities, getCrmAuth } from "@/app/lib/crm";
import { convertOpportunityToCustomerAction } from "@/app/lib/crm-actions";
import { OpportunityStatusSelect } from "./OpportunityStatusSelect";
import Link from "next/link";
import { lusitana } from "@/app/ui/fonts";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, User, UserPlus } from "lucide-react";

type SearchParams = { highlight?: string; leadId?: string };

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  let opportunities: Awaited<ReturnType<typeof getOpportunities>> = [];
  try {
    const auth = await getCrmAuth();
    opportunities = await getOpportunities(auth);
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

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>商机管理表</h1>
        <Link
          href="/dashboard/crm/opportunities/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          新建商机
        </Link>
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

      <div className="rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 font-medium">商机名称</th>
              <th className="px-4 py-3 font-medium">产品类型</th>
              <th className="px-4 py-3 font-medium">商机金额</th>
              <th className="px-4 py-3 font-medium">创建日期</th>
              <th className="px-4 py-3 font-medium">预计赢单日期</th>
              <th className="px-4 py-3 font-medium">销售人员</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">来源线索</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredOpps.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  暂无数据，点击「新建商机」添加，或从线索转入
                </td>
              </tr>
            ) : (
              filteredOpps.map((opp) => (
                <tr key={opp.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">{opp.name}</td>
                  <td className="px-4 py-3">{opp.productType ?? "-"}</td>
                  <td className="px-4 py-3">
                    {opp.amount != null ? `¥${Number(opp.amount).toLocaleString()}` : "-"}
                  </td>
                  <td className="px-4 py-3">{opp.createdAt.toLocaleDateString("zh-CN")}</td>
                  <td className="px-4 py-3">
                    {opp.expectedCloseDate
                      ? opp.expectedCloseDate.toLocaleDateString("zh-CN")
                      : "-"}
                  </td>
                  <td className="px-4 py-3">{opp.salesPerson?.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <OpportunityStatusSelect opportunityId={opp.id} currentStatus={opp.status} />
                  </td>
                  <td className="px-4 py-3">{opp.lead?.customerName ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!opp.customer && ["待签约", "已赢单"].includes(opp.status) && (
                        <form action={convertOpportunityToCustomerAction.bind(null, opp.id)} className="inline">
                          <Button type="submit" variant="default" size="sm" className="h-7 gap-1">
                            <UserPlus className="h-3.5 w-3.5" />
                            转入客户
                          </Button>
                        </form>
                      )}
                      {opp.customer && (
                        <Button variant="outline" size="sm" asChild className="h-7 gap-1">
                          <Link href="/dashboard/crm/customers" className="inline-flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            查看客户
                          </Link>
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" asChild className="h-7 gap-1">
                        <Link
                          href={`/dashboard/crm/follow-ups?opportunityId=${opp.id}`}
                          className="inline-flex items-center gap-1.5"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          跟进记录
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        状态说明：初步沟通 → 方案确认 → 待签约/已赢单（可转入客户）| 已丢单
      </p>
    </main>
  );
}
