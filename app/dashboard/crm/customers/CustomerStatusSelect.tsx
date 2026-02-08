"use client";

import { useState } from "react";
import { updateCustomerStatusWithFollowUpAction } from "@/app/lib/crm-actions";
import { useAlert } from "@/hooks/use-alert";
import { StatusChangeDialog } from "../components/StatusChangeDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["预备签约", "已签约", "流失"];

export function CustomerStatusSelect({
  customerId,
  currentStatus,
  onOptimisticUpdate,
  onRevert,
}: {
  customerId: string;
  currentStatus: string;
  onOptimisticUpdate?: (newStatus: string) => void;
  onRevert?: (previousStatus: string) => void;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showAlert, AlertComponent } = useAlert();

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === currentStatus) return;
    setSelectedStatus(newStatus);
    setIsDialogOpen(true);
  };

  const handleConfirm = async (content: string) => {
    const previousStatus = currentStatus;
    onOptimisticUpdate?.(selectedStatus);
    setIsDialogOpen(false);
    setIsSubmitting(true);
    try {
      const result = await updateCustomerStatusWithFollowUpAction(
        customerId,
        selectedStatus,
        content
      );
      if (result?.error) {
        onRevert?.(previousStatus);
        showAlert(result.error, { type: "error", title: "操作失败" });
      }
    } catch (error) {
      console.error("更新状态失败:", error);
      onRevert?.(previousStatus);
      showAlert("更新状态失败，已恢复原状态", { type: "error", title: "操作失败" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "预备签约":
        return "bg-yellow-100 text-yellow-800";
      case "已签约":
        return "bg-green-100 text-green-800";
      case "流失":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <>
      <AlertComponent />
      <Select value={currentStatus} onValueChange={handleStatusChange}>
        <SelectTrigger
          className={cn(
            "h-8 min-w-[90px] text-xs font-medium border-0 shadow-none",
            getStatusColor(currentStatus)
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((status) => (
            <SelectItem key={status} value={status}>
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <StatusChangeDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={handleConfirm}
        title="修改客户状态"
        defaultContent={`客户状态由「${currentStatus}」变更为「${selectedStatus}」`}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
