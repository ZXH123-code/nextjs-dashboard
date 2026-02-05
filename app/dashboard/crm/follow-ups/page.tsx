import { getFollowUps, getCrmAuth } from "@/app/lib/crm";
import { prisma } from "@/app/lib/prisma";
import Link from "next/link";
import { lusitana } from "@/app/ui/fonts";

type SearchParams = { customerId?: string; opportunityId?: string };

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters =
    params.customerId || params.opportunityId
      ? { customerId: params.customerId, opportunityId: params.opportunityId }
      : undefined;

  let followUps: Awaited<ReturnType<typeof getFollowUps>> = [];
  try {
    const auth = await getCrmAuth();
    followUps = await getFollowUps(auth, filters);
  } catch (e) {
    console.error("获取跟进记录失败:", e);
  }

  // 获取筛选条件的可读名称（客户名、商机名及所属客户）
  let filterLabel: string | null = null;
  if (params.customerId) {
    const c = await prisma.crm_customer.findUnique({
      where: { id: params.customerId },
      select: { name: true },
    });
    filterLabel = c ? `客户：${c.name}` : `客户ID: ${params.customerId}`;
  } else if (params.opportunityId) {
    const o = await prisma.crm_opportunity.findUnique({
      where: { id: params.opportunityId },
      include: { customer: { select: { name: true } } },
    });
    if (o) {
      filterLabel = o.customer
        ? `商机：${o.name}（客户：${o.customer.name}）`
        : `商机：${o.name}`;
    } else {
      filterLabel = `商机ID: ${params.opportunityId}`;
    }
  }

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>跟进记录</h1>
        <Link
          href="/dashboard/crm/follow-ups/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          新建跟进
        </Link>
      </div>

      {(params.customerId || params.opportunityId) && filterLabel && (
        <p className="mb-4 text-sm text-muted-foreground">
          当前筛选：{filterLabel}
          <Link href="/dashboard/crm/follow-ups" className="ml-2 text-primary hover:underline">
            清除筛选
          </Link>
        </p>
      )}

      <div className="rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 font-medium">跟进日期</th>
              <th className="px-4 py-3 font-medium">跟进人</th>
              <th className="px-4 py-3 font-medium">关联客户</th>
              <th className="px-4 py-3 font-medium">关联商机</th>
              <th className="px-4 py-3 font-medium">沟通对象</th>
              <th className="px-4 py-3 font-medium">一句话进展</th>
              <th className="px-4 py-3 font-medium">跟进内容</th>
            </tr>
          </thead>
          <tbody>
            {followUps.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  暂无数据，点击「新建跟进」添加
                </td>
              </tr>
            ) : (
              followUps.map((f) => (
                <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">{f.followDate.toLocaleDateString("zh-CN")}</td>
                  <td className="px-4 py-3">{f.followUpBy?.name ?? "-"}</td>
                  <td className="px-4 py-3">{f.customer?.name ?? "-"}</td>
                  <td className="px-4 py-3">{f.opportunity?.name ?? "-"}</td>
                  <td className="px-4 py-3">{f.contactPerson ?? "-"}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate">{f.summary ?? "-"}</td>
                  <td className="px-4 py-3 max-w-[300px] truncate">{f.content}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        跟进记录需关联客户或商机，可从客户/商机详情页进入筛选查看
      </p>
    </main>
  );
}
