"use client";

import { useState } from "react";
import { updateOpportunityStatusWithFollowUpAction } from "@/app/lib/crm-actions";
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

const STATUS_OPTIONS = ["初步沟通", "方案确认", "待签约", "已赢单", "已丢单"];

export function OpportunityStatusSelect({
  opportunityId,
  currentStatus,
}: {
  opportunityId: string;
  currentStatus: string;
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
    setIsSubmitting(true);
    try {
      const result = await updateOpportunityStatusWithFollowUpAction(
        opportunityId,
        selectedStatus,
        content
      );
      if (result?.error) {
        showAlert(result.error, { type: "error", title: "操作失败" });
      } else {
        setIsDialogOpen(false);
        window.location.reload();
      }
    } catch (error) {
      console.error("更新状态失败:", error);
      showAlert("更新状态失败", { type: "error", title: "操作失败" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "初步沟通":
        return "bg-gray-100 text-gray-800";
      case "方案确认":
        return "bg-blue-100 text-blue-800";
      case "待签约":
        return "bg-yellow-100 text-yellow-800";
      case "已赢单":
        return "bg-green-100 text-green-800";
      case "已丢单":
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
        title="修改商机状态"
        defaultContent={`商机状态由「${currentStatus}」变更为「${selectedStatus}」`}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
