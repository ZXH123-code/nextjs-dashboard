"use client";

import { useState, useEffect } from "react";
import { getPendingNotificationSummaryAction, sendPendingNotificationsAction } from "@/app/lib/crm-actions";
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

type SalesPerson = {
  id: string;
  name: string;
  email: string;
  assignedCount: number;
  unassignedCount: number;
};

export function PendingNotificationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success: string[];
    failed: { id: string; name: string; error: string }[];
  } | null>(null);
  const { showAlert, AlertComponent } = useAlert();

  useEffect(() => {
    if (open) {
      loadPendingNotifications();
    }
  }, [open]);

  const loadPendingNotifications = async () => {
    setLoading(true);
    try {
      const data = await getPendingNotificationSummaryAction();
      setSalesPersons(data.salesPersons);
      setSelectedIds(data.salesPersons.map((sp) => sp.id)); // 默认全选
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(
      selectedIds.length === salesPersons.length ? [] : salesPersons.map((sp) => sp.id)
    );
  };

  const handleSend = async () => {
    if (selectedIds.length === 0) {
      showAlert("请至少选择一个销售人员", { type: "warning", title: "提示" });
      return;
    }
    setSending(true);
    try {
      const res = await sendPendingNotificationsAction(selectedIds);
      setResult(res);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setSelectedIds([]);
    setSalesPersons([]);
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
            发送线索变更通知
          </DialogTitle>
          <DialogDescription>
            选择要通知的销售人员，系统将发送线索分配变更通知邮件
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
          </div>
        ) : !result ? (
          <>
            {salesPersons.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无待通知的销售人员
              </div>
            ) : (
              <>
                <div className="max-h-[400px] space-y-2 overflow-y-auto">
                  <div className="mb-2 flex items-center justify-between border-b pb-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === salesPersons.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-input"
                      />
                      全选（共 {salesPersons.length} 人）
                    </label>
                  </div>

                  {salesPersons.map((person) => {
                    return (
                      <label
                        key={person.id}
                        className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(person.id)}
                          onChange={() => toggleSelect(person.id)}
                          className="mt-1 h-4 w-4 rounded border-input"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{person.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {person.email}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            {person.assignedCount > 0 && (
                              <div className="flex items-center gap-1 text-green-600">
                                <UserPlus className="h-3.5 w-3.5" />
                                <span>新接手 {person.assignedCount} 条</span>
                              </div>
                            )}
                            {person.unassignedCount > 0 && (
                              <div className="flex items-center gap-1 text-orange-600">
                                <UserMinus className="h-3.5 w-3.5" />
                                <span>被转走 {person.unassignedCount} 条</span>
                              </div>
                            )}
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
            )}
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
                    {result.success.map((id) => {
                      const person = salesPersons.find((sp) => sp.id === id);
                      return (
                        <div key={id}>
                          {person?.name} ({person?.email})
                        </div>
                      );
                    })}
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
