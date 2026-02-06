"use client";

import { useState } from "react";
import { sendBatchLeadAssignmentNotificationsAction } from "@/app/lib/crm-actions";
import { useAlert } from "@/hooks/use-alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, CheckCircle2, XCircle, UserPlus, UserMinus } from "lucide-react";

type SalesPersonMap = Record<
  string,
  {
    name: string;
    email: string;
    leadIds: string[];
    leadNames: string[];
    isNewAssignee?: boolean; // 是否为新接手的销售
  }
>;

export function EmailNotificationDialog({
  open,
  onOpenChange,
  salesPersonMap,
  newSalesPersonId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesPersonMap: SalesPersonMap;
  newSalesPersonId?: string;
}) {
  const salesPersonIds = Object.keys(salesPersonMap);
  const [selectedIds, setSelectedIds] = useState<string[]>(salesPersonIds); // 默认全选
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success: string[];
    failed: { id: string; name: string; error: string }[];
  } | null>(null);
  const { showAlert, AlertComponent } = useAlert();

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(
      selectedIds.length === salesPersonIds.length ? [] : salesPersonIds
    );
  };

  const handleSend = async () => {
    if (selectedIds.length === 0) {
      showAlert("请至少选择一个销售人员", { type: "warning", title: "提示" });
      return;
    }
    setSending(true);
    try {
      const res = await sendBatchLeadAssignmentNotificationsAction(
        selectedIds,
        salesPersonMap
      );
      setResult(res);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setSelectedIds(salesPersonIds);
    onOpenChange(false);
  };

  return (
    <>
      <AlertComponent />
      <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            发送邮件通知
          </DialogTitle>
          <DialogDescription>
            选择要通知的销售人员，系统将发送线索指定通知邮件
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <>
            <div className="max-h-[400px] space-y-2 overflow-y-auto">
              <div className="mb-2 flex items-center justify-between border-b pb-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === salesPersonIds.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-input"
                  />
                  全选（共 {salesPersonIds.length} 人）
                </label>
              </div>

              {salesPersonIds.map((id) => {
                const person = salesPersonMap[id];
                const isNewAssignee = id === newSalesPersonId;
                return (
                  <label
                    key={id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(id)}
                      onChange={() => toggleSelect(id)}
                      className="mt-1 h-4 w-4 rounded border-input"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {isNewAssignee ? (
                          <UserPlus className="h-4 w-4 text-green-600" />
                        ) : (
                          <UserMinus className="h-4 w-4 text-orange-600" />
                        )}
                        <span className="font-medium">{person.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {person.email}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${isNewAssignee
                              ? "bg-green-100 text-green-700"
                              : "bg-orange-100 text-orange-700"
                            }`}
                        >
                          {isNewAssignee ? "新接手" : "被转走"}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {person.leadIds.length} 条线索：
                        {person.leadNames.slice(0, 3).join("、")}
                        {person.leadNames.length > 3 && ` 等`}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={handleClose} disabled={sending}>
                取消
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    发送中...
                  </>
                ) : (
                  `发送给选中的 ${selectedIds.length} 人`
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3">
              {result.success.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    发送成功（{result.success.length}）
                  </div>
                  <div className="ml-6 space-y-1 text-sm text-muted-foreground">
                    {result.success.map((id) => (
                      <div key={id}>
                        {salesPersonMap[id]?.name} ({salesPersonMap[id]?.email})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.failed.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                    <XCircle className="h-4 w-4" />
                    发送失败（{result.failed.length}）
                  </div>
                  <div className="ml-6 space-y-1 text-sm">
                    {result.failed.map((f) => (
                      <div key={f.id}>
                        <span className="font-medium">{f.name}</span>
                        <span className="text-red-600">：{f.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>关闭</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
