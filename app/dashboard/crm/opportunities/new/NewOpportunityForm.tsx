"use client";

import Link from "next/link";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OPPORTUNITY_STATUS } from "@/app/lib/crm-constants";

type Lead = { id: string; customerName: string; city: string | null };
type User = { id: string; name: string };

interface NewOpportunityFormProps {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  availableLeads: Lead[];
  users: User[];
  preselectedLeadId: string;
  defaultName: string;
  role: string;
  currentUserId: string;
  currentUserName: string;
}

export function NewOpportunityForm({
  action,
  availableLeads,
  users,
  preselectedLeadId,
  defaultName,
  role,
  currentUserId,
  currentUserName,
}: NewOpportunityFormProps) {
  const leadOptions = [
    { value: "", label: "无" },
    ...availableLeads.map((l) => ({
      value: l.id,
      label: `${l.customerName}${l.city ? ` - ${l.city}` : ""}`,
    })),
  ];

  const salesOptions = [
    { value: "", label: "未指定（关联线索时自动带出）" },
    ...users.map((u) => ({ value: u.id, label: u.name })),
  ];

  return (
    <form action={action} className="max-w-xl space-y-4 rounded-lg border bg-card p-6">
      <div className="space-y-2">
        <Label htmlFor="name">商机名称 *</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="请输入商机名称"
          defaultValue={defaultName}
        />
      </div>
      <div className="space-y-2">
        <Label>来源线索</Label>
        {preselectedLeadId ? (
          <>
            <input type="hidden" name="leadId" value={preselectedLeadId} />
            <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
              <span className="font-medium text-foreground">
                {availableLeads.find((l) => l.id === preselectedLeadId)?.customerName ?? "已绑定线索"}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">（从线索表新建，已自动绑定）</span>
            </div>
          </>
        ) : (
          <FormSelect
            name="leadId"
            value=""
            options={leadOptions}
            placeholder="选择有意向的线索"
          />
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="productType">产品类型</Label>
        <Input id="productType" name="productType" placeholder="选填" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">商机金额</Label>
        <Input id="amount" name="amount" type="number" placeholder="选填" />
      </div>
      <div className="space-y-2">
        <Label>销售人员</Label>
        {role === "admin" ? (
          <FormSelect
            name="salesPersonId"
            value=""
            options={salesOptions}
            placeholder="选择销售人员"
          />
        ) : (
          <>
            <input type="hidden" name="salesPersonId" value={currentUserId} />
            <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
              {currentUserName}（不可更改）
            </div>
          </>
        )}
      </div>
      <div className="space-y-2">
        <Label>状态</Label>
        <FormSelect
          name="status"
          value="初步沟通"
          options={OPPORTUNITY_STATUS.map((s) => ({ value: s, label: s }))}
          placeholder="选择状态"
        />
      </div>
      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          保存
        </button>
        <Link
          href="/dashboard/crm/opportunities"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          取消
        </Link>
      </div>
    </form>
  );
}
