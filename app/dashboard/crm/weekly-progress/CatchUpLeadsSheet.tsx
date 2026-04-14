"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useDebounce } from "use-debounce";
import { ExternalLink, Loader2, ListPlus, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  createQuickLeadFollowUpAction,
  getLeadsForCatchUpListAction,
} from "@/app/lib/crm-actions";
import type { CatchUpLeadRow } from "@/app/lib/crm";
import { useRouter } from "next/navigation";
import { useAlert } from "@/hooks/use-alert";
import { cn } from "@/lib/utils";

const textareaClass =
  "min-h-[52px] flex-1 resize-y rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

function CatchUpLeadRow({
  lead,
  onSubmitted,
  showAlert,
}: {
  lead: CatchUpLeadRow;
  onSubmitted: () => void;
  showAlert: ReturnType<typeof useAlert>["showAlert"];
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const v = text.trim();
    if (!v) {
      showAlert("请填写跟进内容", { type: "warning", title: "提示" });
      return;
    }
    startTransition(async () => {
      const res = await createQuickLeadFollowUpAction(lead.id, v);
      if (res.error) {
        showAlert(res.error, { type: "error", title: "提交失败" });
        return;
      }
      setText("");
      showAlert("已写入，该线索在符合当前时间筛选时会出现在主列表中", {
        type: "success",
        title: "成功",
      });
      onSubmitted();
    });
  };

  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{lead.customerName}</div>
          {lead.nickname ? (
            <div className="truncate text-xs text-muted-foreground">{lead.nickname}</div>
          ) : null}
          {lead.opportunityName ? (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              商机 · {lead.opportunityName}
            </div>
          ) : null}
        </div>
        <Link
          href={`/dashboard/crm/leads/${lead.id}/edit`}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="打开线索详情"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={pending}
          rows={2}
          className={textareaClass}
          placeholder="最简跟进内容…"
          aria-label={`为 ${lead.customerName} 写跟进`}
        />
        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0 px-3"
          disabled={pending}
          onClick={submit}
          title="提交"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </div>
    </div>
  );
}

export function CatchUpLeadsSheet() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 350, { leading: true });
  const [leads, setLeads] = useState<CatchUpLeadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showAlert, AlertComponent } = useAlert();

  const fetchList = useCallback(async (s: string) => {
    setLoading(true);
    try {
      const data = await getLeadsForCatchUpListAction(s);
      setLeads(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchList(debouncedQuery);
  }, [open, debouncedQuery, fetchList]);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) setQuery("");
  };

  const afterSubmit = useCallback(() => {
    router.refresh();
    void fetchList(debouncedQuery);
  }, [router, fetchList, debouncedQuery]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <AlertComponent />
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          title="在可查线索中搜索，选中后快速写一条跟进"
        >
          <ListPlus className="h-4 w-4" aria-hidden />
          搜索线索写跟进
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex h-full w-full max-w-full flex-col sm:max-w-lg">
        <SheetHeader className="space-y-1 pr-8 text-left">
          <SheetTitle>搜索线索写跟进</SheetTitle>
          <SheetDescription>
            在可查线索中搜索目标，写一条最简跟进即可；保存后若跟进落在页面上方所选时段内，会出现在下方主列表。
          </SheetDescription>
        </SheetHeader>

        <div className="relative mt-3 shrink-0">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="客户名、简称或商机名…"
            className="pl-9"
            autoComplete="off"
          />
        </div>

        <div
          className={cn(
            "mt-3 min-h-0 flex-1 overflow-y-auto pr-1",
            loading && "flex items-center justify-center"
          )}
        >
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin shrink-0" aria-hidden />
              加载中…
            </div>
          ) : leads.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">未找到线索</p>
          ) : (
            <div className="space-y-3 pb-4">
              {leads.map((lead) => (
                <CatchUpLeadRow
                  key={lead.id}
                  lead={lead}
                  onSubmitted={afterSubmit}
                  showAlert={showAlert}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
