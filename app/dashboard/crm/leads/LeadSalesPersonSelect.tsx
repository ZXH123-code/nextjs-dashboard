"use client";

import { useState } from "react";
import { updateLeadSalesPersonWithFollowUpAction } from "@/app/lib/crm-actions";
import { PermissionDeniedDialog } from "../components/PermissionDeniedDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const EMPTY_VALUE = "__empty__";

type User = { id: string; name: string };

export function LeadSalesPersonSelect({
  leadId,
  currentSalesPersonId,
  users,
  canAssign = true,
  onOptimisticUpdate,
  onRevert,
}: {
  leadId: string;
  currentSalesPersonId: string | null;
  users: User[];
  /** 仅管理员可指定/变更销售人员，sales 为只读 */
  canAssign?: boolean;
  onOptimisticUpdate?: (newSalesPersonId: string | null) => void;
  onRevert?: (previousSalesPersonId: string | null) => void;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });
  const [selectedSalesPersonId, setSelectedSalesPersonId] = useState("");
  const [supplement, setSupplement] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentSalesPerson = users.find((u) => u.id === currentSalesPersonId);
  const selectedPerson = users.find((u) => u.id === selectedSalesPersonId);

  if (!canAssign) {
    return (
      <span className="text-muted-foreground text-xs">
        {currentSalesPerson?.name ?? "未指定"}
      </span>
    );
  }

  const handleSalesPersonChange = (newValue: string) => {
    const newSalesPersonId = newValue === EMPTY_VALUE ? "" : newValue;
    if (newSalesPersonId === (currentSalesPersonId ?? "")) return;

    setSelectedSalesPersonId(newSalesPersonId);
    setSupplement("");
    setIsDialogOpen(true);
  };

  const selectValue = (currentSalesPersonId ?? "") || EMPTY_VALUE;

  // 与批量指定一致的默认说明：未指定→指定 / 变更负责人 / 取消指定
  const defaultLine = selectedSalesPersonId
    ? currentSalesPersonId
      ? `线索负责人由 ${currentSalesPerson?.name ?? "未指定"} 变更为 ${selectedPerson?.name ?? ""}`
      : `线索已分配给 ${selectedPerson?.name ?? ""}`
    : "线索负责人已取消指定";

  const handleConfirm = async () => {
    const content = supplement.trim() ? `${defaultLine}\n${supplement.trim()}` : defaultLine;
    const previousId = currentSalesPersonId ?? null;
    const newId = selectedSalesPersonId || null;
    onOptimisticUpdate?.(newId);
    setIsDialogOpen(false);
    setIsSubmitting(true);
    try {
      const result = await updateLeadSalesPersonWithFollowUpAction(
        leadId,
        newId,
        content
      );
      if (result?.error) {
        onRevert?.(previousId);
        setErrorDialog({ open: true, message: result.error });
      }
    } catch (error) {
      console.error("分配销售人员失败:", error);
      onRevert?.(previousId);
      setErrorDialog({ open: true, message: "分配销售人员失败，已恢复原负责人。" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSupplement("");
      setIsDialogOpen(false);
    }
  };

  return (
    <>
      <Select value={selectValue} onValueChange={handleSalesPersonChange}>
        <SelectTrigger className="h-8 min-w-[100px] text-xs">
          <SelectValue placeholder="未指定" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY_VALUE}>未指定</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>指定负责人</DialogTitle>
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
                {defaultLine}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="single-assign-supplement">补充说明（选填）</Label>
              <textarea
                id="single-assign-supplement"
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

      <PermissionDeniedDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog((p) => ({ ...p, open }))}
        title="操作失败"
        description={errorDialog.message}
      />
    </>
  );
}
