import { Card } from "@/app/ui/dashboard/cards";
import {
  LeadStatusChart,
  OpportunityStatusChart,
  LeadSourceChart,
  DailyTrendChart,
  FunnelChart,
} from "@/app/ui/dashboard/charts";
import {
  getCrmCounts,
  getCrmAuth,
  getCrmDashboardCharts,
  getMonthlyPlanStats,
} from "@/app/lib/crm";
import { lusitana } from "@/app/ui/fonts";

export default async function Page() {
  let leadCount = 0,
    opportunityCount = 0,
    customerCount = 0;
  let signedCustomerCount = 0,
    pendingCustomerCount = 0;
  let monthlyPlanStats = { total: 0, contacted: 0, opportunityCount: 0, customerCount: 0 };
  let chartData = null;
  try {
    const auth = await getCrmAuth();
    const [counts, charts, mpStats] = await Promise.all([
      getCrmCounts(auth),
      getCrmDashboardCharts(auth),
      getMonthlyPlanStats(auth),
    ]);
    leadCount = counts.leadCount;
    opportunityCount = counts.opportunityCount;
    customerCount = counts.customerCount;
    signedCustomerCount = counts.signedCustomerCount ?? 0;
    pendingCustomerCount = counts.pendingCustomerCount ?? 0;
    monthlyPlanStats = mpStats;
    chartData = charts;
  } catch (e) {
    console.error("获取 CRM 统计失败:", e);
  }

  const monthlyFunnelData = [
    { label: "本月计划", value: monthlyPlanStats.total, unit: "条" },
    { label: "本月已联系", value: monthlyPlanStats.contacted, unit: "条" },
    { label: "转化商机", value: monthlyPlanStats.opportunityCount, unit: "个" },
    { label: "转化客户", value: monthlyPlanStats.customerCount, unit: "家" },
  ];

  const historyFunnelData = [
    { label: "线索", value: leadCount, unit: "条" },
    { label: "商机", value: opportunityCount, unit: "个" },
    { label: "待签约", value: pendingCustomerCount, unit: "家" },
    { label: "已签约", value: signedCustomerCount, unit: "家" },
  ];

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

      {/* 漏斗看板 */}
      <div className="mt-6 grid gap-6 grid-cols-1 lg:grid-cols-2">
        <FunnelChart title="本月漏斗" data={monthlyFunnelData} />
        <FunnelChart title="历史漏斗" data={historyFunnelData} />
      </div>

      <div className="mt-6 rounded-xl bg-gray-50 p-6">
        <p className="text-muted-foreground">
          欢迎使用 CRM 简易系统，请从左侧菜单进入线索管理、商机管理或客户管理。
        </p>
      </div>
    </main>
  );
}
