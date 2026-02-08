"use client";

import { useState } from "react";
import { updateOpportunityAction } from "@/app/lib/crm-actions";
import { useAlert } from "@/hooks/use-alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMPTY_VALUE = "__empty__";

type User = { id: string; name: string };

export function OpportunitySalesPersonSelect({
  opportunityId,
  opportunityName,
  currentSalesPersonId,
  users,
  canAssign = true,
  onOptimisticUpdate,
  onRevert,
}: {
  opportunityId: string;
  opportunityName: string;
  currentSalesPersonId: string | null;
  users: User[];
  canAssign?: boolean;
  onOptimisticUpdate?: (newSalesPersonId: string | null) => void;
  onRevert?: (previousSalesPersonId: string | null) => void;
}) {
  const { showAlert, AlertComponent } = useAlert();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentSalesPerson = users.find((u) => u.id === currentSalesPersonId);

  if (!canAssign) {
    return (
      <>
        <span className="text-muted-foreground text-xs">
          {currentSalesPerson?.name ?? "未指定"}
        </span>
      </>
    );
  }

  const handleSalesPersonChange = async (newValue: string) => {
    const newSalesPersonId = newValue === EMPTY_VALUE ? "" : newValue;
    if (newSalesPersonId === (currentSalesPersonId ?? "")) return;

    const previousId = currentSalesPersonId ?? null;
    const newId = newSalesPersonId || null;
    onOptimisticUpdate?.(newId);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("opportunityId", opportunityId);
      formData.append("name", opportunityName);
      formData.append("salesPersonId", newSalesPersonId);
      formData.append("inline", "1");

      const result = await updateOpportunityAction(null, formData);
      if (result?.error) {
        onRevert?.(previousId);
        showAlert(result.error, { type: "error", title: "更新失败" });
      } else {
        showAlert("销售人员已更新", { type: "success", title: "已保存" });
      }
    } catch (error) {
      console.error("更新商机销售人员失败:", error);
      onRevert?.(previousId);
      showAlert("更新失败，已恢复原负责人", { type: "error", title: "更新失败" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectValue = (currentSalesPersonId ?? "") || EMPTY_VALUE;

  return (
    <>
      <AlertComponent />
      <Select
        value={selectValue}
        onValueChange={handleSalesPersonChange}
        disabled={isSubmitting}
      >
        <SelectTrigger className="h-8 min-w-[60px] gap-2 text-xs">
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
    </>
  );
}
