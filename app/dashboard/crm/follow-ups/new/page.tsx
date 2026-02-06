import { getLeads, getCustomers, getOpportunities, getCrmAuth } from "@/app/lib/crm";
import { FollowUpForm } from "../FollowUpForm";
import Link from "next/link";
import { lusitana } from "@/app/ui/fonts";

export default async function NewFollowUpPage() {
  let leads: Awaited<ReturnType<typeof getLeads>> = [];
  let customers: Awaited<ReturnType<typeof getCustomers>> = [];
  let opportunities: Awaited<ReturnType<typeof getOpportunities>> = [];
  try {
    const auth = await getCrmAuth();
    [leads, customers, opportunities] = await Promise.all([
      getLeads(auth),
      getCustomers(auth),
      getOpportunities(auth),
    ]);
  } catch {
    // ignore
  }

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4 flex items-center gap-4">
        <Link href="/dashboard/crm/follow-ups" className="text-muted-foreground hover:text-foreground">
          ← 返回
        </Link>
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>新建跟进记录</h1>
      </div>

      <FollowUpForm
        leads={leads.map((l) => ({
          id: l.id,
          customerName: l.customerName,
        }))}
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          opportunityId: c.opportunity?.id ?? null,
        }))}
        opportunities={opportunities.map((o) => ({
          id: o.id,
          name: o.name,
          customerId: o.customer?.id ?? null,
        }))}
      />

      <p className="mt-4 text-sm text-muted-foreground">
        建议至少关联线索、客户或商机其一，便于按类型筛选跟进记录
      </p>
    </main>
  );
}
