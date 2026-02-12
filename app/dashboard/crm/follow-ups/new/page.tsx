import { getLeads, getCustomers, getOpportunities, getCrmAuth } from "@/app/lib/crm";
import { FollowUpForm } from "../FollowUpForm";
import Link from "next/link";
import { lusitana } from "@/app/ui/fonts";

export default async function NewFollowUpPage() {
  let leads: Awaited<ReturnType<typeof getLeads>>["items"] = [];
  let customers: Awaited<ReturnType<typeof getCustomers>>["items"] = [];
  let opportunities: Awaited<ReturnType<typeof getOpportunities>>["items"] = [];
  try {
    const auth = await getCrmAuth();
    const [leadsRes, customersRes, opportunitiesRes] = await Promise.all([
      getLeads(auth),
      getCustomers(auth),
      getOpportunities(auth),
    ]);
    leads = leadsRes.items;
    customers = customersRes.items;
    opportunities = opportunitiesRes.items;
  } catch {
    // ignore
  }

  return (
    <main className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/crm/follow-ups" className="text-muted-foreground hover:text-foreground text-sm">
            ← 返回跟进记录
          </Link>
        </div>
        <h1 className={`${lusitana.className} text-xl md:text-2xl font-semibold`}>新建跟进记录</h1>
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
          leadId: c.opportunity?.lead?.id ?? null,
        }))}
        opportunities={opportunities.map((o) => ({
          id: o.id,
          name: o.name,
          customerId: o.customer?.id ?? null,
          leadId: o.lead?.id ?? null,
        }))}
      />
    </main>
  );
}
