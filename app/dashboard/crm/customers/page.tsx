import { getCustomers, getCrmAuth } from "@/app/lib/crm";
import Link from "next/link";
import { lusitana } from "@/app/ui/fonts";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export default async function CustomersPage() {
  let customers: Awaited<ReturnType<typeof getCustomers>> = [];
  try {
    const auth = await getCrmAuth();
    customers = await getCustomers(auth);
  } catch (e) {
    console.error("获取客户失败:", e);
  }

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>客户管理表</h1>
        <Link
          href="/dashboard/crm/customers/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          新建客户
        </Link>
      </div>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 font-medium">客户名称</th>
              <th className="px-4 py-3 font-medium">昵称</th>
              <th className="px-4 py-3 font-medium">城市</th>
              <th className="px-4 py-3 font-medium">客户分层</th>
              <th className="px-4 py-3 font-medium">行业</th>
              <th className="px-4 py-3 font-medium">初次维护日期</th>
              <th className="px-4 py-3 font-medium">销售人员</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">来源商机</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  暂无数据，点击「新建客户」添加，或从商机转入
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3">{c.nickname ?? "-"}</td>
                  <td className="px-4 py-3">{c.city ?? "-"}</td>
                  <td className="px-4 py-3">{c.customerTier ?? "-"}</td>
                  <td className="px-4 py-3">{c.industry ?? "-"}</td>
                  <td className="px-4 py-3">
                    {c.firstMaintenanceDate
                      ? c.firstMaintenanceDate.toLocaleDateString("zh-CN")
                      : "-"}
                  </td>
                  <td className="px-4 py-3">{c.salesPerson?.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs ${c.status === "已签约"
                          ? "bg-green-100 text-green-800"
                          : c.status === "流失"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{c.opportunity?.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`/dashboard/crm/follow-ups?customerId=${c.id}`}
                        className="inline-flex items-center gap-1.5"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        跟进记录
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        客户来源于商机（待签约/已赢单时转入），或可直接新建
      </p>
    </main>
  );
}
