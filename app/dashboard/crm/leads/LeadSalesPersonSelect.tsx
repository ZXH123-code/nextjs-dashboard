"use client";

import { useState } from "react";
import { updateLeadSalesPersonWithFollowUpAction } from "@/app/lib/crm-actions";
import { StatusChangeDialog } from "../components/StatusChangeDialog";
import { PermissionDeniedDialog } from "../components/PermissionDeniedDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMPTY_VALUE = "__empty__";

type User = { id: string; name: string };

export function LeadSalesPersonSelect({
  leadId,
  currentSalesPersonId,
  users,
  canAssign = true,
}: {
  leadId: string;
  currentSalesPersonId: string | null;
  users: User[];
  /** 仅管理员可指定/变更销售人员，sales 为只读 */
  canAssign?: boolean;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });
  const [selectedSalesPersonId, setSelectedSalesPersonId] = useState("");
  const [selectedSalesPersonName, setSelectedSalesPersonName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentSalesPerson = users.find((u) => u.id === currentSalesPersonId);

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

    const newSalesPerson = users.find((u) => u.id === newSalesPersonId);
    setSelectedSalesPersonId(newSalesPersonId);
    setSelectedSalesPersonName(newSalesPerson?.name ?? "未指定");
    setIsDialogOpen(true);
  };

  const selectValue = (currentSalesPersonId ?? "") || EMPTY_VALUE;

  const handleConfirm = async (content: string) => {
    setIsSubmitting(true);
    try {
      const result = await updateLeadSalesPersonWithFollowUpAction(
        leadId,
        selectedSalesPersonId || null,
        content
      );
      if (result?.error) {
        setErrorDialog({ open: true, message: result.error });
      } else {
        setIsDialogOpen(false);
        window.location.reload();
      }
    } catch (error) {
      console.error("分配销售人员失败:", error);
      setErrorDialog({ open: true, message: "分配销售人员失败，请重试。" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDefaultContent = () => {
    if (selectedSalesPersonId) {
      if (currentSalesPersonId) {
        return `线索负责人由 ${currentSalesPerson?.name ?? "未指定"} 变更为 ${selectedSalesPersonName}`;
      } else {
        return `线索已分配给 ${selectedSalesPersonName}`;
      }
    } else {
      return `线索负责人已取消指定`;
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

      <StatusChangeDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={handleConfirm}
        title="分配销售人员"
        defaultContent={getDefaultContent()}
        isSubmitting={isSubmitting}
      />

      <PermissionDeniedDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog((p) => ({ ...p, open }))}
        title="操作失败"
        description={errorDialog.message}
      />
    </>
  );
}
