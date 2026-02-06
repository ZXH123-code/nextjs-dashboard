"use client";

import { useState } from "react";
import { updateCustomerStatusWithFollowUpAction } from "@/app/lib/crm-actions";
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
}: {
  customerId: string;
  currentStatus: string;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === currentStatus) return;
    setSelectedStatus(newStatus);
    setIsDialogOpen(true);
  };

  const handleConfirm = async (content: string) => {
    setIsSubmitting(true);
    try {
      const result = await updateCustomerStatusWithFollowUpAction(
        customerId,
        selectedStatus,
        content
      );
      if (result?.error) {
        alert(result.error);
      } else {
        setIsDialogOpen(false);
        window.location.reload();
      }
    } catch (error) {
      console.error("更新状态失败:", error);
      alert("更新状态失败");
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
