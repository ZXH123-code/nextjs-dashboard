"use client";

import { useState } from "react";
import { deleteLeadAction } from "@/app/lib/crm-actions";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle } from "lucide-react";

export function DeleteLeadButton({
  leadId,
  leadName,
  hasOpportunity,
}: {
  leadId: string;
  leadName: string;
  hasOpportunity?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    const form = document.getElementById(`delete-lead-${leadId}`) as HTMLFormElement | null;
    if (form) {
      form.requestSubmit();
    }
    setOpen(false);
  };

  return (
    <>
      <form id={`delete-lead-${leadId}`} action={deleteLeadAction} className="inline">
        <input type="hidden" name="leadId" value={leadId} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除
        </Button>
      </form>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg border bg-card p-4 shadow-lg">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h2 className="text-sm font-semibold text-foreground">确认删除线索</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              确定要删除线索「{leadName}」吗？此操作不可恢复。
              {hasOpportunity && " 该线索关联的商机及客户将一并删除。"}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="px-3"
                onClick={() => setOpen(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="px-3"
                onClick={handleConfirm}
              >
                确认删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
