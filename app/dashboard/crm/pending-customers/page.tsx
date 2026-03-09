import { getCustomers, getCrmAuth, getPageForCustomerId } from "@/app/lib/crm";
import { CustomersTable } from "../customers/CustomersTable";
import { Pagination } from "@/components/ui/pagination";
import { redirect } from "next/navigation";
import { lusitana } from "@/app/ui/fonts";
import { auth } from "@/auth";

type SearchParams = { highlight?: string; page?: string; pageSize?: string; sortBy?: string; sortOrder?: string };

export default async function PendingCustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(params.pageSize ?? "20", 10) || 20));
  const sortBy = params.sortBy === "signedAt" || params.sortBy === "firstMaintenanceDate" || params.sortBy === "name" ? params.sortBy : "createdAt";
  const sortOrder = params.sortOrder === "asc" ? "asc" : "desc";

  const crmAuth = await getCrmAuth();
  const statusFilter = "预备签约";

  if (params.highlight?.trim()) {
    const targetPage = await getPageForCustomerId(crmAuth, params.highlight, pageSize, { statusFilter });
    if (targetPage !== page) {
      const q = new URLSearchParams();
      q.set("page", String(targetPage));
      q.set("pageSize", String(pageSize));
      q.set("highlight", params.highlight);
      if (params.sortBy) q.set("sortBy", params.sortBy);
      if (params.sortOrder) q.set("sortOrder", params.sortOrder);
      redirect(`/dashboard/crm/pending-customers?${q.toString()}`);
    }
  }

  let customers: Awaited<ReturnType<typeof getCustomers>>["items"] = [];
  let total = 0;
  let currentUserRole = "sales";
  let currentUserId: string | undefined;
  try {
    const customersRes = await getCustomers(crmAuth, { page, pageSize, statusFilter, sortBy, sortOrder });
    customers = customersRes.items;
    total = customersRes.total;
    const session = await auth();
    currentUserRole = (session?.user as { role?: string })?.role ?? "sales";
    currentUserId = (session?.user as { id?: string })?.id;
  } catch (e) {
    console.error("获取待签约客户失败:", e);
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4">
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>待签约客户管理表</h1>
      </div>

      <CustomersTable
        customers={customers}
        currentUserRole={currentUserRole}
        currentUserId={currentUserId}
        isAdmin={currentUserRole === "admin"}
        highlightId={params.highlight}
        basePath="/dashboard/crm/pending-customers"
        sortBy={sortBy}
        sortOrder={sortOrder}
        defaultSortOption={{ value: "createdAt-desc", label: "默认（创建时间新→旧）" }}
      />

      <Pagination
        basePath="/dashboard/crm/pending-customers"
        currentPage={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        preserveParams={{ highlight: params.highlight, sortBy, sortOrder }}
      />

      <p className="mt-4 text-sm text-muted-foreground">
        待签约客户来源于商机（待签约时转入）。签约后状态变为「已签约」将转入客户管理表。
      </p>
    </main>
  );
}
