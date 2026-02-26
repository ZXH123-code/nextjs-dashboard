"use client";

import { useActionState } from "react";
import { Prisma } from "@prisma/client";
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
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  city: string | null;
  address: string | null;
  industry: string | null;
  leadSource: string | null;
  customerTier: string | null;
  status: string;
  remark: string | null;
  importSource: string | null;
  extraFields: Prisma.JsonValue | null;
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
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contactPerson">联系人</Label>
          <Input
            id="contactPerson"
            name="contactPerson"
            defaultValue={lead.contactPerson ?? ""}
            placeholder="例如：张三、李总"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactPhone">联系方式</Label>
          <Input
            id="contactPhone"
            name="contactPhone"
            defaultValue={lead.contactPhone ?? ""}
            placeholder="手机号或座机"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contactEmail">联系人邮箱</Label>
        <Input
          id="contactEmail"
          name="contactEmail"
          type="email"
          defaultValue={lead.contactEmail ?? ""}
          placeholder="选填"
        />
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
        <Label htmlFor="remark">线索备注</Label>
        <textarea
          id="remark"
          name="remark"
          defaultValue={lead.remark ?? ""}
          placeholder="可记录客户需求、背景信息等"
          className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
      {(lead.importSource ||
        (lead.extraFields &&
          typeof lead.extraFields === "object" &&
          !Array.isArray(lead.extraFields) &&
          Object.keys(lead.extraFields).length > 0)) && (
        <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">其他信息（只读）</div>
          {lead.importSource && (
            <div>
              <span className="font-medium">导入来源：</span>
              <span>{lead.importSource}</span>
            </div>
          )}
          {lead.extraFields &&
            typeof lead.extraFields === "object" &&
            !Array.isArray(lead.extraFields) &&
            Object.keys(lead.extraFields).length > 0 && (
              <div className="mt-1 space-y-1">
                {Object.entries(lead.extraFields as Record<string, unknown>).map(([key, value]) => (
                <div key={key} className="flex gap-1">
                  <span className="min-w-[72px] shrink-0 text-muted-foreground">{key}：</span>
                  <span className="break-all">
                    {typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
