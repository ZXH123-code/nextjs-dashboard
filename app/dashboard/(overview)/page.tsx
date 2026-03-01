import { Card } from "@/app/ui/dashboard/cards";
import {
  LeadStatusChart,
  OpportunityStatusChart,
  LeadSourceChart,
  DailyTrendChart,
} from "@/app/ui/dashboard/charts";
import {
  getCrmCounts,
  getCrmAuth,
  getCrmDashboardCharts,
} from "@/app/lib/crm";
import { lusitana } from "@/app/ui/fonts";

export default async function Page() {
  let leadCount = 0,
    opportunityCount = 0,
    customerCount = 0;
  let chartData = null;
  try {
    const auth = await getCrmAuth();
    const [counts, charts] = await Promise.all([
      getCrmCounts(auth),
      getCrmDashboardCharts(auth),
    ]);
    leadCount = counts.leadCount;
    opportunityCount = counts.opportunityCount;
    customerCount = counts.customerCount;
    chartData = charts;
  } catch (e) {
    console.error("获取 CRM 统计失败:", e);
  }

  return (
    <main className="p-6 md:p-8">
      <h1 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
        驾驶舱
      </h1>

      {/* 核心指标卡片 */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="线索总数" value={leadCount} type="leads" />
        <Card title="商机总数" value={opportunityCount} type="opportunities" />
        <Card title="客户总数" value={customerCount} type="customers" />
      </div>

      {/* 图表看板 */}
      {chartData && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <LeadStatusChart data={chartData.leadStatusDistribution} />
          <OpportunityStatusChart
            data={chartData.opportunityStatusDistribution}
          />
          <LeadSourceChart data={chartData.leadSourceDistribution} />
          <div className="sm:col-span-2 lg:col-span-3">
            <DailyTrendChart data={chartData.dailyTrend} />
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl bg-gray-50 p-6">
        <p className="text-muted-foreground">
          欢迎使用 CRM 简易系统，请从左侧菜单进入线索管理、商机管理或客户管理。
        </p>
      </div>
    </main>
  );
}
