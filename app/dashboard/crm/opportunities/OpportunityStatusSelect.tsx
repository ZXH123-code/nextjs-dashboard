"use client";

import { updateOpportunityStatusFormAction } from "@/app/lib/crm-actions";
import { FormSelect } from "@/components/ui/form-select";

const STATUS_OPTIONS = ["初步沟通", "方案确认", "待签约", "已赢单", "已丢单"].map(
  (s) => ({ value: s, label: s })
);

export function OpportunityStatusSelect({
  opportunityId,
  currentStatus,
}: {
  opportunityId: string;
  currentStatus: string;
}) {
  return (
    <form action={updateOpportunityStatusFormAction} className="inline">
      <input type="hidden" name="opportunityId" value={opportunityId} />
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
