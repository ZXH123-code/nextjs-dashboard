import { createOpportunityAction } from "@/app/lib/crm-actions";
import { getLeads, getCrmAuth, getUsers } from "@/app/lib/crm";
import Link from "next/link";
import { lusitana } from "@/app/ui/fonts";
import { NewOpportunityForm } from "./NewOpportunityForm";

type SearchParams = { leadId?: string };

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const preselectedLeadId = params.leadId ?? "";

  let leads: Awaited<ReturnType<typeof getLeads>> = [];
  let users: Awaited<ReturnType<typeof getUsers>> = [];
  let auth: Awaited<ReturnType<typeof getCrmAuth>> = null;
  try {
    auth = await getCrmAuth();
    [leads, users] = await Promise.all([getLeads(auth), getUsers()]);
  } catch {
    // ignore
  }
  const availableLeads = leads.filter((l) => l.status === "有意向" && !l.opportunity);
  const preselectedLead = preselectedLeadId
    ? availableLeads.find((l) => l.id === preselectedLeadId)
    : null;
  const role = auth?.role ?? "sales";
  const currentUserId = auth?.userId ?? "";
  const currentUserName = users.find((u) => u.id === currentUserId)?.name ?? "当前用户";

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4 flex items-center gap-4">
        <Link href="/dashboard/crm/opportunities" className="text-muted-foreground hover:text-foreground">
          ← 返回
        </Link>
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>新建商机</h1>
      </div>

      <NewOpportunityForm
        action={createOpportunityAction}
        availableLeads={availableLeads}
        users={users}
        preselectedLeadId={preselectedLeadId}
        defaultName={preselectedLead?.customerName ?? ""}
        role={role}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
      />
    </main>
  );
}
