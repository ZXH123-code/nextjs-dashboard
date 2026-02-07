import { getLeads, getCrmAuth, getUsers } from "@/app/lib/crm";
import { LeadsTableWithBulk } from "./LeadsTableWithBulk";
import { LeadsPageActions } from "./LeadsPageActions";
import { lusitana } from "@/app/ui/fonts";

type SearchParams = { highlight?: string };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

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
        <LeadsPageActions isAdmin={isAdmin} />
      </div>

      <LeadsTableWithBulk 
        leads={leads} 
        users={users} 
        isAdmin={isAdmin} 
        currentUserRole={auth?.role}
        currentUserId={auth?.userId}
        highlightId={params.highlight}
      />

      <p className="mt-4 text-sm text-muted-foreground">
        状态说明：未跟进 → 有意向（自动生成商机并可补全）| 无意向。管理员可新建线索、批量导入及编辑全部；销售人员可表格内编辑自己负责的线索。
      </p>
    </main>
  );
}
