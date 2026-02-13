"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { batchUpdateCustomerSalesPersonAction, batchDeleteCustomersAction } from "@/app/lib/crm-actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/hooks/use-confirm";
import { useAlert } from "@/hooks/use-alert";
import { UserPlus, Trash2, X } from "lucide-react";
import { LoadingSpinner } from "@/app/ui/loading-spinner";

type User = { id: string; name: string };

export function CustomersBulkBar({
  selectedIds,
  onClear,
  users,
}: {
  selectedIds: string[];
  onClear: () => void;
  users: User[];
}) {
  const router = useRouter();
  const { showConfirm, ConfirmComponent } = useConfirm();
  const { showAlert, AlertComponent } = useAlert();
  const [salesPersonId, setSalesPersonId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [assignError, setAssignError] = useState("");

  async function handleAssign() {
    if (!salesPersonId) {
      setAssignError("请选择销售人员");
      return;
    }
    setAssignError("");
    setAssignLoading(true);
    try {
      const result = await batchUpdateCustomerSalesPersonAction(selectedIds, salesPersonId);
      if (result?.error) {
        setAssignError(result.error);
      } else {
        showAlert(`已为 ${selectedIds.length} 条客户指定负责人`, { type: "success", title: "批量指定成功" });
        setSalesPersonId("");
        onClear();
        router.refresh();
      }
    } finally {
      setAssignLoading(false);
    }
  }

  function handleBatchDelete() {
    showConfirm(
      {
        title: "确认批量删除",
        description: `确定要删除选中的 ${selectedIds.length} 条客户吗？删除后其跟进记录会保留，但不再关联客户。此操作不可恢复。`,
        confirmText: "确认删除",
        variant: "destructive",
      },
      async () => {
        setDeleteLoading(true);
        try {
          const result = await batchDeleteCustomersAction(selectedIds);
          if (result?.error) {
            showAlert(result.error, { type: "error", title: "删除失败" });
          } else {
            showAlert("已删除选中的客户", { type: "success", title: "删除成功" });
            onClear();
            router.refresh();
          }
        } finally {
          setDeleteLoading(false);
        }
      }
    );
  }

  return (
    <>
      <ConfirmComponent />
      <AlertComponent />
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm">
        <span className="text-sm font-medium text-foreground">
          已选 <strong>{selectedIds.length}</strong> 条客户
        </span>
        <div className="flex items-center gap-2">
          <Select value={salesPersonId} onValueChange={setSalesPersonId}>
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue placeholder="指定负责人" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleAssign}
            disabled={assignLoading || !salesPersonId}
            className="gap-1.5"
          >
            {assignLoading ? (
              <LoadingSpinner type="arc" size={16} className="shrink-0" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            批量指定
          </Button>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleBatchDelete}
          disabled={deleteLoading}
        >
          {deleteLoading ? (
            <LoadingSpinner type="arc" size={16} className="shrink-0" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          批量删除
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} className="ml-auto gap-1.5">
          <X className="h-4 w-4" />
          取消选择
        </Button>
        {assignError && (
          <span className="text-sm text-destructive">{assignError}</span>
        )}
      </div>
    </>
  );
}
