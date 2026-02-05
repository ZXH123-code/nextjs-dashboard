import { getLeads, getCrmAuth, getUsers } from "@/app/lib/crm";
import { LeadsTableWithBulk } from "./LeadsTableWithBulk";
import Link from "next/link";
import { lusitana } from "@/app/ui/fonts";
import { Button } from "@/components/ui/button";

export default async function LeadsPage() {
  let leads: Awaited<ReturnType<typeof getLeads>> = [];
  let users: Awaited<ReturnType<typeof getUsers>> = [];
  let auth: Awaited<ReturnType<typeof getCrmAuth>> = null;
  try {
    auth = await getCrmAuth();
    [leads, users] = await Promise.all([getLeads(auth), getUsers()]);
  } catch (e) {
    console.error("获取线索失败:", e);
  }
  const isAdmin = auth?.role === "admin";

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>线索管理表</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/crm/leads/import">批量导入</Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link href="/dashboard/crm/leads/new">新建线索</Link>
          </Button>
        </div>
      </div>

      <LeadsTableWithBulk leads={leads} users={users} isAdmin={isAdmin} />

      <p className="mt-4 text-sm text-muted-foreground">
        状态说明：未跟进 → 跟进中 → 有意向（可新建商机，自动绑定该线索）| 无意向
      </p>
    </main>
  );
}
