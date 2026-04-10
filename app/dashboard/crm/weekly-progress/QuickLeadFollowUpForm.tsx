"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, PenLine, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createQuickLeadFollowUpAction } from "@/app/lib/crm-actions";
import { useAlert } from "@/hooks/use-alert";
import { cn } from "@/lib/utils";

const inputClass =
  "min-h-[72px] w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function QuickLeadFollowUpForm({ leadId }: { leadId: string }) {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showAlert, AlertComponent } = useAlert();

  const submit = () => {
    const v = text.trim();
    if (!v) {
      showAlert("请填写跟进内容", { type: "warning", title: "提示" });
      return;
    }
    startTransition(async () => {
      const res = await createQuickLeadFollowUpAction(leadId, v);
      if (res.error) {
        showAlert(res.error, { type: "error", title: "提交失败" });
        return;
      }
      setText("");
      router.refresh();
      showAlert("已保存跟进记录", { type: "success", title: "成功" });
    });
  };

  return (
    <>
      <AlertComponent />
      <div
        className={cn(
          "rounded-xl border border-border/90 bg-muted/20 p-3 shadow-sm",
          "ring-1 ring-border/40"
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <PenLine className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
            快速记跟进
          </div>
          <Link
            href={`/dashboard/crm/leads/${leadId}/edit`}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            打开线索详情
            <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
          </Link>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !e.ctrlKey && !e.metaKey) return;
              e.preventDefault();
              if (!isPending) submit();
            }}
            disabled={isPending}
            rows={3}
            className={inputClass}
            placeholder="输入本次跟进内容…（Ctrl+Enter 提交）"
            aria-label="跟进内容"
          />
          <Button
            type="button"
            size="default"
            className="h-10 shrink-0 rounded-xl px-5 sm:self-stretch sm:h-auto sm:min-h-[72px]"
            disabled={isPending}
            onClick={submit}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            {isPending ? "提交中…" : "提交"}
          </Button>
        </div>
      </div>
    </>
  );
}
