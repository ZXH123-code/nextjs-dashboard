"use client";

import { useActionState } from "react";
import { createLeadAction } from "@/app/lib/crm-actions";
import { LEAD_STATUS } from "@/app/lib/crm-constants";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/form-select";

type User = { id: string; name: string };

async function wrapAction(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const result = await createLeadAction(formData);
  return result ?? null;
}

export function NewLeadForm({ users }: { users: User[] }) {
  const [state, setStateAction] = useActionState(wrapAction, null);

  return (
    <form
      action={async (fd: FormData) => {
        const result = await wrapAction(null, fd);
        if (result?.error) {
          setStateAction(fd);
        }
      }}
      className="max-w-xl space-y-4 rounded-lg border bg-card p-6"
    >
      {state?.error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      )}
      <div className="space-y-2">
        <Label htmlFor="customerName">客户名称 *</Label>
        <Input
          id="customerName"
          name="customerName"
          required
          placeholder="请输入客户名称"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nickname">昵称</Label>
        <Input id="nickname" name="nickname" placeholder="选填" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="city">城市</Label>
        <Input id="city" name="city" placeholder="选填" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">详细地址</Label>
        <Input id="address" name="address" placeholder="选填" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="industry">行业</Label>
        <Input id="industry" name="industry" placeholder="选填" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="leadSource">线索来源</Label>
        <Input id="leadSource" name="leadSource" placeholder="如：展会、转介绍" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="customerTier">客户分层</Label>
        <Input id="customerTier" name="customerTier" placeholder="如：A/B/C" />
      </div>
      <div className="space-y-2">
        <Label>销售人员</Label>
        <FormSelect
          name="salesPersonId"
          value=""
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
          value="未跟进"
          options={LEAD_STATUS.map((s) => ({ value: s, label: s }))}
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
          href="/dashboard/crm/leads"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          取消
        </Link>
      </div>
    </form>
  );
}
