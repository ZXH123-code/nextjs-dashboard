"use client";

import { useActionState, useState, useMemo } from "react";
import { createFollowUpAction } from "@/app/lib/crm-actions";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/form-select";

type Customer = { id: string; name: string; opportunityId: string | null };
type Opportunity = { id: string; name: string; customerId: string | null };

export function FollowUpForm({
  customers,
  opportunities,
}: {
  customers: Customer[];
  opportunities: Opportunity[];
}) {
  const [state, formAction, isPending] = useActionState(createFollowUpAction, null);
  const [customerId, setCustomerId] = useState("");
  const [opportunityId, setOpportunityId] = useState("");

  // 选客户后：商机仅显示该客户的来源商机
  const filteredOpportunities = useMemo(() => {
    if (!customerId) return opportunities;
    const cust = customers.find((c) => c.id === customerId);
    if (!cust?.opportunityId) return [];
    const opp = opportunities.find((o) => o.id === cust.opportunityId);
    return opp ? [opp] : [];
  }, [customerId, customers, opportunities]);

  // 选商机后：自动带出对应客户
  const handleOpportunityChange = (val: string) => {
    setOpportunityId(val);
    if (val) {
      const opp = opportunities.find((o) => o.id === val);
      if (opp?.customerId) setCustomerId(opp.customerId);
    } else {
      setCustomerId("");
    }
  };

  const handleCustomerChange = (val: string) => {
    setCustomerId(val);
    if (val) {
      const cust = customers.find((c) => c.id === val);
      if (cust?.opportunityId) {
        setOpportunityId(cust.opportunityId);
      } else {
        setOpportunityId("");
      }
    } else {
      setOpportunityId("");
    }
  };

  const customerOptions = [
    { value: "", label: "无" },
    ...customers.map((c) => ({ value: c.id, label: c.name })),
  ];
  const opportunityOptions = [
    { value: "", label: "无" },
    ...filteredOpportunities.map((o) => ({ value: o.id, label: o.name })),
  ];

  return (
    <form action={formAction} className="max-w-xl space-y-4 rounded-lg border bg-card p-6">
      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium">跟进内容 *</label>
        <textarea
          name="content"
          required
          rows={4}
          disabled={isPending}
          className="w-full rounded-md border px-3 py-2"
          placeholder="请输入跟进记录内容"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">跟进日期 *</label>
        <input
          name="followDate"
          type="date"
          required
          disabled={isPending}
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div className="space-y-2">
        <Label>关联客户</Label>
        <FormSelect
          name="customerId"
          value={customerId}
          options={customerOptions}
          placeholder="选择关联客户"
          disabled={isPending}
          onValueChange={handleCustomerChange}
        />
      </div>
      <div className="space-y-2">
        <Label>关联商机</Label>
        <FormSelect
          name="opportunityId"
          value={opportunityId}
          options={opportunityOptions}
          placeholder={customerId ? "仅显示该客户的商机" : "选择关联商机"}
          disabled={isPending}
          onValueChange={handleOpportunityChange}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">沟通对象</label>
        <input
          name="contactPerson"
          disabled={isPending}
          className="w-full rounded-md border px-3 py-2"
          placeholder="选填"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">一句话进展</label>
        <input name="summary" disabled={isPending} className="w-full rounded-md border px-3 py-2" placeholder="选填" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">下一步</label>
        <input name="nextStep" disabled={isPending} className="w-full rounded-md border px-3 py-2" placeholder="选填" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">客户需求</label>
        <input
          name="customerNeeds"
          disabled={isPending}
          className="w-full rounded-md border px-3 py-2"
          placeholder="选填"
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
          href="/dashboard/crm/follow-ups"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          取消
        </Link>
      </div>
    </form>
  );
}
