"use client";

import { updateLeadSalesPersonFormAction } from "@/app/lib/crm-actions";
import { FormSelect } from "@/components/ui/form-select";

type User = { id: string; name: string };

export function LeadSalesPersonSelect({
  leadId,
  currentSalesPersonId,
  users,
}: {
  leadId: string;
  currentSalesPersonId: string | null;
  users: User[];
}) {
  const options = [
    { value: "", label: "未指定" },
    ...users.map((u) => ({ value: u.id, label: u.name })),
  ];
  return (
    <form action={updateLeadSalesPersonFormAction} className="inline">
      <input type="hidden" name="leadId" value={leadId} />
      <FormSelect
        name="salesPersonId"
        value={currentSalesPersonId ?? ""}
        options={options}
        placeholder="选择销售人员"
        submitOnChange
        compact
      />
    </form>
  );
}
