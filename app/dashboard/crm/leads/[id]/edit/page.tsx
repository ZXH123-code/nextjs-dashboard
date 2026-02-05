import { getLeadById, getCrmAuth, getUsers, LEAD_STATUS } from "@/app/lib/crm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { lusitana } from "@/app/ui/fonts";
import { EditLeadForm } from "./EditLeadForm";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await getCrmAuth();
  if (!auth || auth.role !== "admin") {
    redirect("/dashboard/crm/leads");
  }

  const lead = await getLeadById(id, auth);
  if (!lead) {
    redirect("/dashboard/crm/leads");
  }

  let users: Awaited<ReturnType<typeof getUsers>> = [];
  try {
    users = await getUsers();
  } catch {
    // ignore
  }

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4 flex items-center gap-4">
        <Link href="/dashboard/crm/leads" className="text-muted-foreground hover:text-foreground">
          ← 返回
        </Link>
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>编辑线索</h1>
      </div>

      <EditLeadForm
        lead={lead}
        users={users}
      />
    </main>
  );
}
