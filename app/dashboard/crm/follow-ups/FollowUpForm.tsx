"use client";

import { useActionState, useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createFollowUpAction } from "@/app/lib/crm-actions";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/ui/form-select";

type Lead = { id: string; customerName: string };
type Customer = { id: string; name: string; opportunityId: string | null };
type Opportunity = { id: string; name: string; customerId: string | null };

async function uploadFollowUpImage(followUpId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.set("file", file);
  const res = await fetch(`/api/crm/follow-ups/${followUpId}/images/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "上传失败");
  }
}

export function FollowUpForm({
  leads,
  customers,
  opportunities,
}: {
  leads: Lead[];
  customers: Customer[];
  opportunities: Opportunity[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createFollowUpAction, null);
  const [leadId, setLeadId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const hasRedirected = useRef(false);

  // 选择线索后：自动清空商机和客户（线索和商机/客户是不同阶段的记录）
  const handleLeadChange = (val: string) => {
    setLeadId(val);
    if (val) {
      // 选了线索后，建议不要同时选商机/客户
      // 但不强制清空，给用户自由度
    }
  };

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
      if (opp?.customerId) {
        setCustomerId(opp.customerId);
      }
    } else {
      setCustomerId("");
    }
  };

  // 选客户后：自动带出对应商机
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

  const leadOptions = [
    { value: "", label: "无" },
    ...leads.map((l) => ({ value: l.id, label: l.customerName })),
  ];
  const customerOptions = [
    { value: "", label: "无" },
    ...customers.map((c) => ({ value: c.id, label: c.name })),
  ];
  const opportunityOptions = [
    { value: "", label: "无" },
    ...filteredOpportunities.map((o) => ({ value: o.id, label: o.name })),
  ];

  // 提交成功后：若有图片则先上传再跳转，否则直接跳转
  useEffect(() => {
    const result = state as { success?: boolean; followUpId?: string } | null;
    if (!result?.followUpId || hasRedirected.current) return;
    hasRedirected.current = true;
    setUploadError(null);

    if (selectedFiles.length === 0) {
      router.push("/dashboard/crm/follow-ups");
      return;
    }

    (async () => {
      try {
        for (const file of selectedFiles) {
          await uploadFollowUpImage(result.followUpId!, file);
        }
        router.push("/dashboard/crm/follow-ups");
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "上传图片失败");
        hasRedirected.current = false;
      }
    })();
  }, [state, selectedFiles.length, router]);

  return (
    <form action={formAction} className="max-w-xl space-y-4 rounded-lg border bg-card p-6">
      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {uploadError && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {uploadError}
        </div>
      )}
      
      {/* 跟进内容 */}
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

      {/* 跟进日期 */}
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

      {/* 上传图片（可选，不随 form 提交，提交成功后按 followUpId 再上传） */}
      <div>
        <label className="mb-1 block text-sm font-medium">上传图片（可选）</label>
        <div
          className="rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-4 transition-colors hover:border-primary/50 hover:bg-muted/30"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isPending) return;
            e.currentTarget.classList.add("border-primary", "bg-muted/40");
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("border-primary", "bg-muted/40");
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.classList.remove("border-primary", "bg-muted/40");
            if (isPending) return;
            const accepted = ["image/jpeg", "image/png", "image/gif", "image/webp"];
            const files = Array.from(e.dataTransfer.files).filter((f) =>
              accepted.includes(f.type)
            );
            if (files.length) setSelectedFiles((prev) => [...prev, ...files]);
          }}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            disabled={isPending}
            className="w-full text-sm text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
            onChange={(e) => {
              const files = e.target.files;
              if (files?.length) setSelectedFiles(Array.from(files));
            }}
          />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            或将图片拖入此处
          </p>
        </div>
        {selectedFiles.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            已选 {selectedFiles.length} 张图片，保存后将自动上传
          </p>
        )}
      </div>

      {/* 关联对象选择区域 */}
      <div className="space-y-4 rounded-md border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-900">关联对象</h3>
        <p className="text-xs text-gray-600">
          选择此跟进记录关联的线索、商机或客户（至少选择一个）
        </p>

        {/* 关联线索 */}
        <div className="space-y-2">
          <Label>关联线索</Label>
          <FormSelect
            name="leadId"
            value={leadId}
            options={leadOptions}
            placeholder="选择关联线索"
            disabled={isPending}
            onValueChange={handleLeadChange}
          />
          <p className="text-xs text-gray-500">
            线索：尚未转化为商机的潜在客户
          </p>
        </div>

        {/* 分割线 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="text-xs text-gray-500">或</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        {/* 关联商机 */}
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
          <p className="text-xs text-gray-500">
            商机：已转化的商业机会，正在推进中
          </p>
        </div>

        {/* 关联客户 */}
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
          <p className="text-xs text-gray-500">
            客户：已签约或预备签约的客户
          </p>
        </div>
      </div>

      {/* 可选补充信息 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">补充信息（可选）</h3>
        
        <div>
          <label className="mb-1 block text-sm font-medium">沟通对象</label>
          <input
            name="contactPerson"
            disabled={isPending}
            className="w-full rounded-md border px-3 py-2"
            placeholder="例如：张经理"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">一句话进展</label>
          <input
            name="summary"
            disabled={isPending}
            className="w-full rounded-md border px-3 py-2"
            placeholder="例如：客户表示有兴趣"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">下一步计划</label>
          <input
            name="nextStep"
            disabled={isPending}
            className="w-full rounded-md border px-3 py-2"
            placeholder="例如：下周一发送产品方案"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">客户需求</label>
          <input
            name="customerNeeds"
            disabled={isPending}
            className="w-full rounded-md border px-3 py-2"
            placeholder="例如：需要支持自定义配置"
          />
        </div>
      </div>

      {/* 提交按钮 */}
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
