"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createFollowUpAction } from "@/app/lib/crm-actions";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/ui/form-select";
import { User, Briefcase, Users } from "lucide-react";

type Lead = { id: string; customerName: string };
type Customer = { id: string; name: string; opportunityId: string | null; leadId: string | null };
type Opportunity = { id: string; name: string; customerId: string | null; leadId: string | null };

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

type LinkType = "customer" | "opportunity" | "lead";

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
  const [isPending, setIsPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<LinkType>("customer");
  const [customerId, setCustomerId] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // 选客户 → 自动带出商机、线索
  const handleCustomerChange = (val: string) => {
    setCustomerId(val);
    if (val) {
      const c = customers.find((x) => x.id === val);
      setOpportunityId(c?.opportunityId ?? "");
      setLeadId(c?.leadId ?? "");
    } else {
      setOpportunityId("");
      setLeadId("");
    }
  };

  // 选商机 → 自动带出客户（若有）、线索
  const handleOpportunityChange = (val: string) => {
    setOpportunityId(val);
    setCustomerId("");
    if (val) {
      const o = opportunities.find((x) => x.id === val);
      setCustomerId(o?.customerId ?? "");
      setLeadId(o?.leadId ?? "");
    } else {
      setLeadId("");
    }
  };

  // 选线索 → 仅线索
  const handleLeadChange = (val: string) => {
    setLeadId(val);
    setCustomerId("");
    setOpportunityId("");
  };

  const customerOptions = [
    { value: "", label: "请选择客户" },
    ...customers.map((c) => ({ value: c.id, label: c.name })),
  ];
  const opportunityOptions = [
    { value: "", label: "请选择商机" },
    ...opportunities.map((o) => ({ value: o.id, label: o.name })),
  ];
  const leadOptions = [
    { value: "", label: "请选择线索" },
    ...leads.map((l) => ({ value: l.id, label: l.customerName })),
  ];

  const selectedCustomer = customerId ? customers.find((c) => c.id === customerId) : null;
  const selectedOpportunity = opportunityId ? opportunities.find((o) => o.id === opportunityId) : null;
  const selectedLead = leadId ? leads.find((l) => l.id === leadId) : null;
  const hasLink = !!(customerId || opportunityId || leadId);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!hasLink || isPending) return;
    setSaveError(null);
    setUploadError(null);
    setIsPending(true);
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const result = await createFollowUpAction(null, formData);
      if (result?.error) {
        setSaveError(result.error);
        return;
      }
      if (result?.success && result?.followUpId) {
        if (selectedFiles.length > 0) {
          try {
            for (const file of selectedFiles) {
              await uploadFollowUpImage(result.followUpId, file);
            }
          } catch (err) {
            setUploadError(err instanceof Error ? err.message : "上传图片失败");
            return;
          }
        }
        router.push("/dashboard/crm/follow-ups");
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <input type="hidden" name="leadId" value={leadId} readOnly />
      <input type="hidden" name="customerId" value={customerId} readOnly />
      <input type="hidden" name="opportunityId" value={opportunityId} readOnly />

      {saveError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          <p className="font-medium">保存失败</p>
          <p className="mt-1">{saveError}</p>
        </div>
      )}
      {uploadError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          <p className="font-medium">上传图片失败</p>
          <p className="mt-1">{uploadError}</p>
        </div>
      )}

      {/* 第一步：关联对象（先客户 → 商机 → 线索） */}
      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">关联对象</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            先选客户（选后自动带出商机、线索）；若无客户再选商机；都没有则选线索。至少选一个。
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => setLinkType("customer")}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              linkType === "customer"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-muted/50"
            }`}
          >
            <Users className="h-4 w-4" />
            先选客户
          </button>
          <button
            type="button"
            onClick={() => setLinkType("opportunity")}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              linkType === "opportunity"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-muted/50"
            }`}
          >
            <Briefcase className="h-4 w-4" />
            再选商机
          </button>
          <button
            type="button"
            onClick={() => setLinkType("lead")}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              linkType === "lead"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-muted/50"
            }`}
          >
            <User className="h-4 w-4" />
            最后选线索
          </button>
        </div>

        <div className="space-y-2">
          {linkType === "customer" && (
            <>
              <Label>选择客户</Label>
              <FormSelect
                name=""
                value={customerId}
                options={customerOptions}
                placeholder="选择客户后，商机与线索将自动带出"
                disabled={isPending}
                onValueChange={handleCustomerChange}
                className="max-w-md"
              />
            </>
          )}
          {linkType === "opportunity" && (
            <>
              <Label>选择商机</Label>
              <FormSelect
                name=""
                value={opportunityId}
                options={opportunityOptions}
                placeholder="选择商机后，线索将自动带出"
                disabled={isPending}
                onValueChange={handleOpportunityChange}
                className="max-w-md"
              />
            </>
          )}
          {linkType === "lead" && (
            <>
              <Label>选择线索</Label>
              <FormSelect
                name=""
                value={leadId}
                options={leadOptions}
                placeholder="选择线索"
                disabled={isPending}
                onValueChange={handleLeadChange}
                className="max-w-md"
              />
            </>
          )}
        </div>

        {hasLink && (
          <div className="mt-4 rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">已关联：</span>
            {selectedCustomer && <span>客户 {selectedCustomer.name}</span>}
            {selectedOpportunity && (
              <span>{selectedCustomer ? " → " : ""}商机 {selectedOpportunity.name}</span>
            )}
            {selectedLead && (
              <span>{(selectedCustomer || selectedOpportunity) ? " → " : ""}线索 {selectedLead.customerName}</span>
            )}
          </div>
        )}
      </section>

      {/* 第二步：跟进内容与日期 */}
      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-foreground">跟进内容</h2>
        <div className="grid gap-6 md:grid-cols-[1fr,auto]">
          <div>
            <Label htmlFor="content">跟进内容 *</Label>
            <textarea
              id="content"
              name="content"
              required
              rows={5}
              disabled={isPending}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="请填写本次跟进记录（电话、拜访、方案沟通等）"
            />
          </div>
          <div className="space-y-4 md:min-w-[200px]">
            <div>
              <Label htmlFor="followDate">跟进日期 *</Label>
              <input
                id="followDate"
                name="followDate"
                type="date"
                required
                disabled={isPending}
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 第三步：补充信息（可选） */}
      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-foreground">补充信息（可选）</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="contactPerson">沟通对象</Label>
            <input
              id="contactPerson"
              name="contactPerson"
              disabled={isPending}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="例如：张经理"
            />
          </div>
          <div>
            <Label htmlFor="summary">一句话进展</Label>
            <input
              id="summary"
              name="summary"
              disabled={isPending}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="例如：客户表示有兴趣"
            />
          </div>
          <div>
            <Label htmlFor="nextStep">下一步计划</Label>
            <input
              id="nextStep"
              name="nextStep"
              disabled={isPending}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="例如：下周一发送方案"
            />
          </div>
          <div>
            <Label htmlFor="customerNeeds">客户需求</Label>
            <input
              id="customerNeeds"
              name="customerNeeds"
              disabled={isPending}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="例如：需要支持自定义配置"
            />
          </div>
        </div>
      </section>

      {/* 第四步：上传图片（可选） */}
      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-foreground">上传图片（可选）</h2>
        <div
          className="rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-6 transition-colors hover:border-primary/50 hover:bg-muted/30"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isPending) e.currentTarget.classList.add("border-primary", "bg-muted/40");
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove("border-primary", "bg-muted/40");
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.classList.remove("border-primary", "bg-muted/40");
            if (isPending) return;
            const accepted = ["image/jpeg", "image/png", "image/gif", "image/webp"];
            const files = Array.from(e.dataTransfer.files).filter((f) => accepted.includes(f.type));
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
          <p className="mt-2 text-center text-sm text-muted-foreground">或将图片拖入此处，保存后将自动上传</p>
        </div>
        {selectedFiles.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">已选 {selectedFiles.length} 张图片</p>
        )}
      </section>

      {/* 提交 */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={isPending || !hasLink}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isPending ? "保存中..." : "保存跟进记录"}
        </button>
        <Link
          href="/dashboard/crm/follow-ups"
          className="rounded-lg border border-input bg-background px-6 py-2.5 text-sm font-medium hover:bg-muted"
        >
          取消
        </Link>
        {!hasLink && (
          <span className="text-sm text-muted-foreground">请先在上方选择关联的客户、商机或线索</span>
        )}
      </div>
    </form>
  );
}
