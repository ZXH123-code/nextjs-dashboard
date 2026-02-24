"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { softDeleteLeadAction } from "@/app/lib/crm-actions";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle } from "lucide-react";
import { useAlert } from "@/hooks/use-alert";

export function DeleteLeadButton({
  leadId,
  leadName,
  hasOpportunity,
}: {
  leadId: string;
  leadName: string;
  hasOpportunity?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { showAlert, AlertComponent } = useAlert();

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      const formData = new FormData();
      formData.append("leadId", leadId);
      const result = await softDeleteLeadAction(formData);
      
      if (result?.error) {
        showAlert(result.error, { type: "error", title: "删除失败" });
      } else {
        showAlert("线索已删除，可在回收站中恢复", { 
          type: "success", 
          title: "删除成功" 
        });
        setOpen(false);
        router.refresh();
      }
    } catch (error) {
      showAlert("删除失败，请稍后重试", { type: "error", title: "删除失败" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <AlertComponent />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
        disabled={deleting}
      >
        <Trash2 className="h-3.5 w-3.5" />
        删除
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg border bg-card p-4 shadow-lg">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h2 className="text-sm font-semibold text-foreground">确认删除线索</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              确定要删除线索「{leadName}」吗？
              <br />
              <span className="text-xs text-muted-foreground">
                删除后线索将被移至回收站，管理员可以恢复。
              </span>
              {hasOpportunity && (
                <span className="mt-1 block text-xs text-amber-600">
                  注意：该线索关联的商机及客户不会自动删除。
                </span>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="px-3"
                onClick={() => setOpen(false)}
                disabled={deleting}
              >
                取消
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="px-3"
                onClick={handleConfirm}
                disabled={deleting}
              >
                {deleting ? "删除中..." : "确认删除"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
