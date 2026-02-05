"use client";

import { updateLeadStatusFormAction } from "@/app/lib/crm-actions";
import { FormSelect } from "@/components/ui/form-select";

const STATUS_OPTIONS = ["未跟进", "跟进中", "有意向", "无意向"].map((s) => ({
  value: s,
  label: s,
}));

export function LeadStatusSelect({
  leadId,
  currentStatus,
}: {
  leadId: string;
  currentStatus: string;
}) {
  return (
    <form action={updateLeadStatusFormAction} className="inline">
      <input type="hidden" name="leadId" value={leadId} />
      <FormSelect
        name="status"
        value={currentStatus}
        options={STATUS_OPTIONS}
        placeholder="选择状态"
        submitOnChange
        compact
      />
    </form>
  );
}
