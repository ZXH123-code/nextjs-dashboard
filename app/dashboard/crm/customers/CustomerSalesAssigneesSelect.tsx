"use client";

import { useState } from "react";
import { setDealAssigneesByCustomerAction } from "@/app/lib/crm-actions";
import { useAlert } from "@/hooks/use-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/app/ui/loading-spinner";

type User = { id: string; name: string };

export function CustomerSalesAssigneesSelect({
  customerId,
  customerName,
  currentAssigneeIds,
  users,
  canAssign = true,
  onOptimisticUpdate,
  onRevert,
}: {
  customerId: string;
  customerName: string;
  currentAssigneeIds: string[];
  users: User[];
  canAssign?: boolean;
  onOptimisticUpdate?: (nextAssigneeIds: string[]) => void;
  onRevert?: (previousAssigneeIds: string[]) => void;
}) {
  const { showAlert, AlertComponent } = useAlert();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [supplement, setSupplement] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentAssignees = users.filter((u) => currentAssigneeIds.includes(u.id));
  const selectedAssignees = users.filter((u) => selectedAssigneeIds.includes(u.id));

  const currentNames = currentAssignees.map((u) => u.name);
  const buttonLabel =
    currentNames.length === 0
      ? "未指定"
      : currentNames.length === 1
        ? currentNames[0]
        : `${currentNames[0]}…`;

  if (!canAssign) {
    return (
      <span
        className="text-muted-foreground text-xs max-w-[140px] inline-block truncate"
        title={currentNames.join("、")}
      >
        {buttonLabel}
      </span>
    );
  }

  const openDialog = () => {
    setSelectedAssigneeIds(Array.from(new Set(currentAssigneeIds)));
    setSupplement("");
    setIsDialogOpen(true);
  };

  const currentSet = new Set(currentAssigneeIds);
  const selectedSet = new Set(selectedAssigneeIds);
  const added = selectedAssignees.filter((u) => !currentSet.has(u.id));
  const removed = currentAssignees.filter((u) => !selectedSet.has(u.id));

  const defaultLines = [
    ...(added.length > 0 ? [`销售负责人新增：${added.map((u) => u.name).join("，")}`] : []),
    ...(removed.length > 0 ? [`销售负责人移除：${removed.map((u) => u.name).join("，")}`] : []),
    ...(added.length === 0 && removed.length === 0 ? ["销售负责人未发生变化"] : []),
  ];

  const handleConfirm = async () => {
    if (selectedAssigneeIds.length === 0) {
      showAlert("至少保留一位销售负责人", { type: "error", title: "无法保存" });
      return;
    }
    const defaultText = defaultLines.join("\n");
    const content = supplement.trim() ? `${defaultText}\n${supplement.trim()}` : defaultText;
    const previousIds = Array.from(new Set(currentAssigneeIds));
    const nextIds = Array.from(new Set(selectedAssigneeIds));
    onOptimisticUpdate?.(nextIds);
    setIsDialogOpen(false);
    setIsSubmitting(true);
    try {
      const result = await setDealAssigneesByCustomerAction(customerId, nextIds, content);
      if (result?.error) {
        onRevert?.(previousIds);
        showAlert(result.error, { type: "error", title: "更新失败" });
      } else {
        showAlert("销售负责人已更新（已同步线索与商机）", { type: "success", title: "已保存" });
      }
    } catch (error) {
      console.error("更新客户负责人失败:", error);
      onRevert?.(previousIds);
      showAlert("更新失败，已恢复原负责人", { type: "error", title: "更新失败" });
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
      <AlertComponent />
      <Button
        type="button"
        variant="outline"
        className="h-8 min-w-[120px] max-w-[160px] justify-start text-xs font-normal"
        onClick={openDialog}
      >
        <span className="truncate" title={currentNames.join("、")}>
          {buttonLabel}
        </span>
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>销售负责人</DialogTitle>
            <DialogDescription>
              与线索、商机共用同一套负责人；首位为主负责人。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-xs text-muted-foreground truncate" title={customerName}>
              客户：{customerName}
            </p>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">默认跟进说明</Label>
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-sm border-input bg-muted/40 text-foreground"
                )}
              >
                {defaultLines.map((l) => (
                  <div key={l}>{l}</div>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">负责人（至少选 1 人）</Label>
              <div className="max-h-56 overflow-auto rounded-md border border-input bg-background">
                <div className="p-2 space-y-1">
                  {users.map((u) => {
                    const checked = selectedAssigneeIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? Array.from(new Set([...selectedAssigneeIds, u.id]))
                              : selectedAssigneeIds.filter((id) => id !== u.id);
                            setSelectedAssigneeIds(next);
                          }}
                        />
                        <span className="text-sm">{u.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cust-assign-supplement">补充说明（选填）</Label>
              <textarea
                id="cust-assign-supplement"
                value={supplement}
                onChange={(e) => setSupplement(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              取消
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting || selectedAssigneeIds.length === 0}
              className="gap-2"
            >
              {isSubmitting ? <LoadingSpinner type="arc" size={16} className="shrink-0" /> : null}
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
