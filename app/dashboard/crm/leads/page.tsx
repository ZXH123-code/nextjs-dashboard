import { getLeads, getCrmAuth, getUsers } from "@/app/lib/crm";
import { LeadsTableWithBulk } from "./LeadsTableWithBulk";
import { LeadsPageActions } from "./LeadsPageActions";
import { Pagination } from "@/components/ui/pagination";
import { lusitana } from "@/app/ui/fonts";

type SearchParams = { highlight?: string; page?: string; pageSize?: string };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(params.pageSize ?? "20", 10) || 20));

  let leads: Awaited<ReturnType<typeof getLeads>>["items"] = [];
  let total = 0;
  let users: Awaited<ReturnType<typeof getUsers>> = [];
  let auth: Awaited<ReturnType<typeof getCrmAuth>> = null;
  try {
    auth = await getCrmAuth();
    const [leadsRes, usersList] = await Promise.all([
      getLeads(auth, { page, pageSize }),
      getUsers(),
    ]);
    leads = leadsRes.items;
    total = leadsRes.total;
    users = usersList;
  } catch (e) {
    console.error("获取线索失败:", e);
  }
  const isAdmin = auth?.role === "admin";
  const totalPages = Math.ceil(total / pageSize);

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

      <Pagination
        basePath="/dashboard/crm/leads"
        currentPage={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        preserveParams={{ highlight: params.highlight }}
      />

      <p className="mt-4 text-sm text-muted-foreground">
        状态说明：未跟进 → 有意向（自动生成商机并可补全）| 无意向。点击「新建线索」可直接增加一行并行内编辑；管理员可指定负责人、批量导入及编辑全部，销售人员新建的线索默认为自己且不可改负责人。
      </p>
    </main>
  );
}
