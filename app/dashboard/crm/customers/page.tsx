import { getCustomers, getCrmAuth } from "@/app/lib/crm";
import { CustomersTable } from "./CustomersTable";
import Link from "next/link";
import { lusitana } from "@/app/ui/fonts";
import { auth } from "@/auth";

type SearchParams = { highlight?: string };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  let customers: Awaited<ReturnType<typeof getCustomers>> = [];
  let currentUserRole = "sales";
  let currentUserId: string | undefined;
  try {
    const crmAuth = await getCrmAuth();
    customers = await getCustomers(crmAuth);
    const session = await auth();
    currentUserRole = (session?.user as { role?: string })?.role ?? "sales";
    currentUserId = (session?.user as { id?: string })?.id;
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

      <CustomersTable
        customers={customers}
        currentUserRole={currentUserRole}
        currentUserId={currentUserId}
        isAdmin={currentUserRole === "admin"}
        highlightId={params.highlight}
      />

      <p className="mt-4 text-sm text-muted-foreground">
        客户来源于商机（待签约/已赢单时转入），或可直接新建。管理员可编辑全部客户，销售人员可编辑自己负责的客户（点击客户名称、昵称、城市、客户分层、行业、初次维护日期进行表格内编辑）。
      </p>
    </main>
  );
}
