import { Card } from "@/app/ui/dashboard/cards";
import { getCrmCounts, getCrmAuth } from "@/app/lib/crm";
import { lusitana } from "@/app/ui/fonts";

export default async function Page() {
  let leadCount = 0,
    opportunityCount = 0,
    customerCount = 0;
  try {
    const auth = await getCrmAuth();
    const counts = await getCrmCounts(auth);
    leadCount = counts.leadCount;
    opportunityCount = counts.opportunityCount;
    customerCount = counts.customerCount;
  } catch (e) {
    console.error("获取 CRM 统计失败:", e);
  }

  return (
    <main className="p-6 md:p-8">
      <h1 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>驾驶舱</h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="线索总数" value={leadCount} type="leads" />
        <Card title="商机总数" value={opportunityCount} type="opportunities" />
        <Card title="客户总数" value={customerCount} type="customers" />
      </div>
      <div className="mt-6 rounded-xl bg-gray-50 p-6">
        <p className="text-muted-foreground">欢迎使用 CRM 简易系统，请从左侧菜单进入线索管理、商机管理或客户管理。</p>
      </div>
    </main>
  );
}
