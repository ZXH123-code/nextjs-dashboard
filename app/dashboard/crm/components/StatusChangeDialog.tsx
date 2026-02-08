"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface StatusChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (content: string) => void;
  title: string;
  defaultContent: string; // 默认跟进说明（只读展示），与分配负责人弹框一致
  isSubmitting?: boolean;
}

/**
 * 状态变更对话框：默认跟进说明 + 补充说明（选填），与分配线索给销售人员的弹框一致
 */
export function StatusChangeDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  defaultContent,
  isSubmitting = false,
}: StatusChangeDialogProps) {
  const [supplement, setSupplement] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSupplement("");
    }
  }, [isOpen]);

  const handleConfirm = () => {
    const content = supplement.trim()
      ? `${defaultContent}\n${supplement.trim()}`
      : defaultContent;
    onConfirm(content);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSupplement("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            将自动生成一条默认跟进说明，您可在下方补充更多说明。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-muted-foreground">默认跟进说明</Label>
              <span className="text-xs text-muted-foreground">根据当前选择自动生成</span>
            </div>
            <div
              className={cn(
                "rounded-md border px-3 py-2 text-sm border-input bg-muted/40 text-foreground"
              )}
              aria-live="polite"
            >
              {defaultContent}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status-change-supplement">补充说明（选填）</Label>
            <textarea
              id="status-change-supplement"
              value={supplement}
              onChange={(e) => setSupplement(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="可在此补充更多说明，将接在默认说明下方"
              disabled={isSubmitting}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
