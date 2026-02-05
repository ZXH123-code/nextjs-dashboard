"use client";

import { useActionState } from "react";
import { updateLeadAction } from "@/app/lib/crm-actions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/form-select";
import { LEAD_STATUS } from "@/app/lib/crm-constants";
import Link from "next/link";

type Lead = {
  id: string;
  customerName: string;
  nickname: string | null;
  city: string | null;
  address: string | null;
  industry: string | null;
  leadSource: string | null;
  customerTier: string | null;
  salesPersonId: string | null;
  status: string;
};

type User = { id: string; name: string };

export function EditLeadForm({
  lead,
  users,
}: {
  lead: Lead;
  users: User[];
}) {
  const [state, formAction, isPending] = useActionState(updateLeadAction, null);

  return (
    <form action={formAction} className="max-w-xl space-y-4 rounded-lg border bg-card p-6">
      <input type="hidden" name="leadId" value={lead.id} />
      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="customerName">客户名称 *</Label>
        <Input
          id="customerName"
          name="customerName"
          required
          defaultValue={lead.customerName}
          placeholder="请输入客户名称"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nickname">昵称</Label>
        <Input id="nickname" name="nickname" defaultValue={lead.nickname ?? ""} placeholder="选填" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="city">城市</Label>
        <Input id="city" name="city" defaultValue={lead.city ?? ""} placeholder="选填" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">详细地址</Label>
        <Input id="address" name="address" defaultValue={lead.address ?? ""} placeholder="选填" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="industry">行业</Label>
        <Input id="industry" name="industry" defaultValue={lead.industry ?? ""} placeholder="选填" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="leadSource">线索来源</Label>
        <Input
          id="leadSource"
          name="leadSource"
          defaultValue={lead.leadSource ?? ""}
          placeholder="如：展会、转介绍"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="customerTier">客户分层</Label>
        <Input
          id="customerTier"
          name="customerTier"
          defaultValue={lead.customerTier ?? ""}
          placeholder="如：A/B/C"
        />
      </div>
      <div className="space-y-2">
        <Label>销售人员</Label>
        <FormSelect
          name="salesPersonId"
          value={lead.salesPersonId ?? ""}
          options={[
            { value: "", label: "未指定" },
            ...users.map((u) => ({ value: u.id, label: u.name })),
          ]}
          placeholder="选择销售人员"
        />
      </div>
      <div className="space-y-2">
        <Label>状态</Label>
        <FormSelect
          name="status"
          value={lead.status}
          options={LEAD_STATUS.map((s) => ({ value: s, label: s }))}
          placeholder="选择状态"
        />
      </div>
      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "保存中..." : "保存"}
        </button>
        <Link
          href="/dashboard/crm/leads"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          取消
        </Link>
      </div>
    </form>
  );
}
