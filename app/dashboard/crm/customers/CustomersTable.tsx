"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAlert } from "@/hooks/use-alert";
import { useFilter } from "@/hooks/use-filter";
import { FilterDialog, type FilterField } from "@/components/ui/filter-dialog";
import { CustomerStatusSelect } from "./CustomerStatusSelect";
import { FollowUpTimeline } from "../components/FollowUpTimeline";
import { WriteFollowUpDialog } from "../components/WriteFollowUpDialog";
import { createManualFollowUpAction, updateCustomerAction, syncLeadContactPhoneToOpportunityAction, syncContactPhoneToLeadAction } from "@/app/lib/crm-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, MessageSquarePlus, Filter, X, Check, Briefcase, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { CUSTOMER_STATUS } from "@/app/lib/crm-constants";

type Customer = {
  id: string;
  name: string;
  nickname: string | null;
  city: string | null;
  customerTier: string | null;
  industry: string | null;
  firstMaintenanceDate: Date | null;
  status: string;
  actualAmount: any;
  contactPhone: string | null;
  salesPersonId: string | null;
  salesPerson: { id: string; name: string } | null;
  opportunity: { id: string; name: string; lead: { id: string; contactPhone: string | null } | null } | null;
  createdAt: Date;
};

type EditingState = { customerId: string; field: string; value: string };

export function CustomersTable({
  customers,
  currentUserRole,
  currentUserId,
  isAdmin,
  highlightId,
}: {
  customers: Customer[];
  currentUserRole?: string;
  currentUserId?: string;
  isAdmin?: boolean;
  highlightId?: string;
}) {
  const router = useRouter();
  const { showAlert, AlertComponent } = useAlert();
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Set<string>>(new Set());
  const [writeFollowUpCustomerId, setWriteFollowUpCustomerId] = useState<string | null>(null);
  const [followUpRefreshKeys, setFollowUpRefreshKeys] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  // 细粒度保存状态：Map<"customerId:field", true>
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState(customers);
  const [filterOpen, setFilterOpen] = useState(false);
  /** 客户表修改联系方式成功后，弹框选择同步到商机表/线索表 */
  const [syncContactPhoneDialog, setSyncContactPhoneDialog] = useState<{
    newValue: string;
    opportunityId?: string;
    leadId?: string;
    syncToOpportunity: boolean;
    syncToLead: boolean;
  } | null>(null);
  const [isSyncingContactPhone, setIsSyncingContactPhone] = useState(false);

  // 定义筛选字段
  const filterFields: FilterField[] = [
    { key: "name", label: "客户名称", type: "text" },
    { key: "nickname", label: "昵称", type: "text" },
    { key: "city", label: "城市", type: "text" },
    { key: "customerTier", label: "客户分层", type: "text" },
    { key: "industry", label: "行业", type: "text" },
    { key: "status", label: "状态", type: "select", options: CUSTOMER_STATUS.map(s => ({ value: s, label: s })) },
    { key: "actualAmount", label: "实际成交金额", type: "number" },
    { key: "firstMaintenanceDate", label: "初次维护日期", type: "date" },
  ];

  // 使用筛选 Hook
  const { filteredData, conditions, applyFilter, clearFilter, hasActiveFilters } = useFilter(rows, filterFields);

  // 更新 rows 时同步更新筛选结果
  useEffect(() => {
    setRows(customers);
  }, [customers]);

  useEffect(() => {
    if (highlightId) {
      setExpandedCustomerIds((prev) => new Set(prev).add(highlightId));
      setTimeout(() => {
        const row = document.getElementById(`customer-row-${highlightId}`);
        if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [highlightId]);

  const toggleExpandedCustomer = (id: string) => {
    setExpandedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleWriteFollowUp = async (data: {
    content: string;
    contactPerson?: string;
    summary?: string;
    nextStep?: string;
    customerNeeds?: string;
  }) => {
    if (!writeFollowUpCustomerId) return;

    setIsSubmitting(true);
    try {
      const result = await createManualFollowUpAction({
        customerId: writeFollowUpCustomerId,
        ...data,
      });
      if (result?.error) {
        showAlert(result.error, { type: "error", title: "操作失败" });
      } else {
        const customerIdJustSubmitted = writeFollowUpCustomerId;
        setWriteFollowUpCustomerId(null);
        setFollowUpRefreshKeys((prev) => ({
          ...prev,
          [customerIdJustSubmitted]: (prev[customerIdJustSubmitted] ?? 0) + 1,
        }));
        router.refresh();
      }
    } catch (error) {
      console.error("添加跟进记录失败:", error);
      showAlert("添加跟进记录失败", { type: "error", title: "操作失败" });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    setRows(customers);
  }, [customers]);

  const getCustomerFieldValue = (customer: Customer, field: string): string => {
    switch (field) {
      case "name":
        return customer.name;
      case "nickname":
        return customer.nickname ?? "";
      case "city":
        return customer.city ?? "";
      case "customerTier":
        return customer.customerTier ?? "";
      case "industry":
        return customer.industry ?? "";
      case "contactPhone":
        return customer.contactPhone ?? "";
      case "firstMaintenanceDate":
        return customer.firstMaintenanceDate
          ? customer.firstMaintenanceDate.toISOString().split("T")[0]
          : "";
      case "actualAmount":
        return customer.actualAmount != null ? String(customer.actualAmount) : "";
      default:
        return "";
    }
  };

  const saveCustomerEdit = async () => {
    if (!editing) return;
    const customer = rows.find((c) => c.id === editing.customerId);
    if (!customer) return;
    const current = getCustomerFieldValue(customer, editing.field);
    if (editing.value === current) {
      setEditing(null);
      return;
    }

    const fieldKey = `${editing.customerId}:${editing.field}`;

    // 如果该字段正在保存，直接返回（避免重复保存）
    if (savingFields.has(fieldKey)) return;

    const prevRow = customer;
    const editingField = editing.field;
    const editingCustomerId = editing.customerId;
    const editingValue = editing.value;

    // 乐观更新：立即更新UI
    const nextValue =
      editing.field === "firstMaintenanceDate" && editing.value
        ? new Date(editing.value)
        : editing.field === "firstMaintenanceDate"
          ? null
          : editing.value;
    setRows((prev) =>
      prev.map((c) =>
        c.id === editing.customerId ? { ...c, [editing.field]: nextValue } : c
      )
    );

    // 标记为保存中
    setSavingFields((prev) => new Set(prev).add(fieldKey));

    // 关闭编辑框，允许用户继续编辑其他字段
    setEditing(null);

    // 异步保存（完全异步，不阻塞）
    try {
      const formData = new FormData();
      formData.append("customerId", editingCustomerId);
      formData.append("name", customer.name);
      formData.append("nickname", customer.nickname ?? "");
      formData.append("city", customer.city ?? "");
      formData.append("customerTier", customer.customerTier ?? "");
      formData.append("industry", customer.industry ?? "");
      formData.append("contactPhone", customer.contactPhone ?? "");
      formData.append(
        "firstMaintenanceDate",
        customer.firstMaintenanceDate ? customer.firstMaintenanceDate.toISOString().split("T")[0] : ""
      );
      formData.append("inline", "1");
      formData.set(editingField, editingValue);

      const result = await updateCustomerAction(null, formData);

      if (result?.error) {
        // 保存失败，回滚UI
        setRows((prev) => prev.map((c) => (c.id === prevRow.id ? prevRow : c)));
        showAlert(result.error, { type: "error", title: "操作失败" });
      } else {
        if (editingField === "contactPhone" && prevRow.opportunity) {
          const leadId = prevRow.opportunity.lead?.id;
          setSyncContactPhoneDialog({
            newValue: editingValue.trim(),
            opportunityId: prevRow.opportunity.id,
            leadId,
            syncToOpportunity: true,
            syncToLead: !!leadId,
          });
        } else {
          router.refresh();
        }
      }
    } catch (e) {
      console.error(e);
      // 保存失败，回滚UI
      setRows((prev) => prev.map((c) => (c.id === prevRow.id ? prevRow : c)));
      showAlert("保存失败", { type: "error", title: "操作失败" });
    } finally {
      // 移除保存中状态
      setSavingFields((prev) => {
        const next = new Set(prev);
        next.delete(fieldKey);
        return next;
      });
    }
  };

  const canEditCustomer = (customer: Customer) =>
    isAdmin || (currentUserId != null && customer.salesPersonId === currentUserId);

  const renderCustomerCell = (
    customer: Customer,
    field: string,
    displayValue: string,
    type: "text" | "date" | "number" = "text"
  ) => {
    if (!canEditCustomer(customer)) return <>{displayValue || "-"}</>;
    const isEditing = editing?.customerId === customer.id && editing?.field === field;
    const fieldKey = `${customer.id}:${field}`;
    const isSaving = savingFields.has(fieldKey);

    if (isEditing) {
      return (
        <Input
          autoFocus
          type={type}
          value={editing.value}
          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
          onBlur={saveCustomerEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveCustomerEdit();
            if (e.key === "Escape") setEditing(null);
          }}
          className="h-8 border-primary text-left"
          disabled={isSaving}
        />
      );
    }

    return (
      <div
        onClick={() => {
          if (!isSaving) {
            setEditing({
              customerId: customer.id,
              field,
              value: getCustomerFieldValue(customer, field),
            });
          }
        }}
        className={cn(
          "flex w-full items-center justify-center gap-1 rounded px-2 py-1",
          isSaving ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-blue-50"
        )}
        title={isSaving ? "保存中..." : "点击编辑"}
      >
        <span>{displayValue || <span className="text-muted-foreground">-</span>}</span>
        {isSaving && (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        )}
      </div>
    );
  };

  const currentWriteFollowUpCustomer = rows.find(
    (c) => c.id === writeFollowUpCustomerId
  );

  return (
    <>
      <AlertComponent />
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={hasActiveFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterOpen(true)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            筛选
            {hasActiveFilters && (
              <Badge variant="info" className="ml-1.5 h-5 min-w-[20px] px-1.5 leading-none">
                {conditions.length}
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilter}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              清除筛选
            </Button>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          共 {filteredData.length} 条数据
        </div>
      </div>

      <FilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        fields={filterFields}
        conditions={conditions}
        onApply={applyFilter}
        onClear={clearFilter}
      />

      <div className="rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="w-10 px-4 py-3 text-center font-medium"></th>
              <th className="px-4 py-3 text-center font-medium">客户名称</th>
              <th className="px-4 py-3 text-center font-medium">昵称</th>
              <th className="px-4 py-3 text-center font-medium">城市</th>
              <th className="px-4 py-3 text-center font-medium">客户分层</th>
              <th className="px-4 py-3 text-center font-medium">行业</th>
              <th className="px-4 py-3 text-center font-medium">联系方式</th>
              <th className="px-4 py-3 text-center font-medium">初次维护日期</th>
              <th className="px-4 py-3 text-center font-medium">实际成交金额</th>
              <th className="px-4 py-3 text-center font-medium">销售人员</th>
              <th className="px-4 py-3 text-center font-medium">状态</th>
              <th className="px-4 py-3 text-center font-medium">来源商机</th>
              <th className="px-4 py-3 text-center font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="[&_td]:text-center">
            {customers.length === 0 ? (
              <tr>
                <td
                  colSpan={13}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  暂无数据，点击「新建客户」添加，或从商机转入
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={13}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  没有符合筛选条件的数据
                </td>
              </tr>
            ) : (
              filteredData.map((customer) => (
                <Fragment key={customer.id}>
                  <tr
                    id={`customer-row-${customer.id}`}
                    className={`border-b last:border-0 hover:bg-muted/30 ${highlightId === customer.id ? "animate-highlight-row" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleExpandedCustomer(customer.id)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {expandedCustomerIds.has(customer.id) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {renderCustomerCell(customer, "name", customer.name)}
                    </td>
                    <td className="px-4 py-3">
                      {renderCustomerCell(customer, "nickname", customer.nickname ?? "-")}
                    </td>
                    <td className="px-4 py-3">
                      {renderCustomerCell(customer, "city", customer.city ?? "-")}
                    </td>
                    <td className="px-4 py-3">
                      {renderCustomerCell(customer, "customerTier", customer.customerTier ?? "-")}
                    </td>
                    <td className="px-4 py-3">
                      {renderCustomerCell(customer, "industry", customer.industry ?? "-")}
                    </td>
                    <td className="px-4 py-3">
                      {renderCustomerCell(
                        customer,
                        "contactPhone",
                        customer.contactPhone ?? customer.opportunity?.lead?.contactPhone ?? "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {renderCustomerCell(
                        customer,
                        "firstMaintenanceDate",
                        customer.firstMaintenanceDate
                          ? customer.firstMaintenanceDate.toLocaleDateString("zh-CN")
                          : "-",
                        "date"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {renderCustomerCell(
                        customer,
                        "actualAmount",
                        customer.actualAmount != null
                          ? `¥${Number(customer.actualAmount).toLocaleString()}`
                          : "-",
                        "number"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {customer.salesPerson?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <CustomerStatusSelect
                        customerId={customer.id}
                        currentStatus={customer.status}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {customer.opportunity ? (
                        <Link
                          href={`/dashboard/crm/opportunities`}
                          className="text-primary hover:underline"
                        >
                          {customer.opportunity.name}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1"
                          onClick={() => setWriteFollowUpCustomerId(customer.id)}
                        >
                          <MessageSquarePlus className="h-3.5 w-3.5" />
                          写跟进
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expandedCustomerIds.has(customer.id) && (
                    <tr>
                      <td colSpan={13} className="bg-gray-50 px-4 py-4 !text-left">
                        <div className="rounded-lg border border-gray-200 bg-white p-4 text-left">
                          <h4 className="mb-3 font-semibold text-gray-900 text-left">
                            跟进时间线
                          </h4>
                          <FollowUpTimeline
                            customerId={customer.id}
                            currentUserRole={currentUserRole}
                            refreshKey={followUpRefreshKeys[customer.id] ?? 0}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 写跟进对话框 */}
      {currentWriteFollowUpCustomer && (
        <WriteFollowUpDialog
          isOpen={!!writeFollowUpCustomerId}
          onClose={() => setWriteFollowUpCustomerId(null)}
          onConfirm={handleWriteFollowUp}
          recordType="客户"
          recordName={currentWriteFollowUpCustomer.name}
          isSubmitting={isSubmitting}
        />
      )}

      {/* 联系方式同步到商机表/线索表 */}
      <Dialog
        open={!!syncContactPhoneDialog}
        onOpenChange={(open) => {
          if (!open) {
            setSyncContactPhoneDialog(null);
            router.refresh();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>同步联系方式到</DialogTitle>
            <DialogDescription>
              将联系方式「{syncContactPhoneDialog?.newValue || "（空）"}」同步到已选表，可勾选需要同步的目标：
            </DialogDescription>
          </DialogHeader>
          {syncContactPhoneDialog && (
            <div className="flex flex-col gap-2 py-2">
              {syncContactPhoneDialog.opportunityId && (
                <button
                  type="button"
                  onClick={() =>
                    setSyncContactPhoneDialog((prev) =>
                      prev ? { ...prev, syncToOpportunity: !prev.syncToOpportunity } : prev
                    )
                  }
                  className={cn(
                    "flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                    syncContactPhoneDialog.syncToOpportunity
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-muted bg-muted/30 text-muted-foreground hover:border-muted-foreground/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      syncContactPhoneDialog.syncToOpportunity
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40"
                    )}
                  >
                    {syncContactPhoneDialog.syncToOpportunity ? (
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    ) : null}
                  </span>
                  <Briefcase className="h-5 w-5 shrink-0" />
                  <span className="font-medium">商机表</span>
                </button>
              )}
              {syncContactPhoneDialog.leadId && (
                <button
                  type="button"
                  onClick={() =>
                    setSyncContactPhoneDialog((prev) =>
                      prev ? { ...prev, syncToLead: !prev.syncToLead } : prev
                    )
                  }
                  className={cn(
                    "flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                    syncContactPhoneDialog.syncToLead
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-muted bg-muted/30 text-muted-foreground hover:border-muted-foreground/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      syncContactPhoneDialog.syncToLead
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40"
                    )}
                  >
                    {syncContactPhoneDialog.syncToLead ? (
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    ) : null}
                  </span>
                  <UserRound className="h-5 w-5 shrink-0" />
                  <span className="font-medium">线索表</span>
                </button>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSyncContactPhoneDialog(null);
                router.refresh();
              }}
              disabled={isSyncingContactPhone}
            >
              仅更新客户表
            </Button>
            <Button
              type="button"
              onClick={async () => {
                const d = syncContactPhoneDialog;
                if (!d) return;
                setIsSyncingContactPhone(true);
                try {
                  const tasks: Promise<{ error?: string } | null>[] = [];
                  if (d.syncToOpportunity && d.opportunityId)
                    tasks.push(syncLeadContactPhoneToOpportunityAction(d.opportunityId, d.newValue));
                  if (d.syncToLead && d.leadId)
                    tasks.push(syncContactPhoneToLeadAction(d.leadId, d.newValue));
                  if (tasks.length === 0) {
                    setSyncContactPhoneDialog(null);
                    router.refresh();
                    return;
                  }
                  const results = await Promise.all(tasks);
                  const err = results.find((r) => r?.error);
                  if (err?.error) {
                    showAlert(err.error, { type: "error", title: "同步失败" });
                    return;
                  }
                  const parts = [];
                  if (d.syncToOpportunity && d.opportunityId) parts.push("商机表");
                  if (d.syncToLead && d.leadId) parts.push("线索表");
                  showAlert(`联系方式已同步到${parts.join("、")}`, { type: "success", title: "已同步" });
                  setSyncContactPhoneDialog(null);
                  router.refresh();
                } catch (e) {
                  console.error(e);
                  showAlert("同步失败，请重试", { type: "error", title: "同步失败" });
                } finally {
                  setIsSyncingContactPhone(false);
                }
              }}
              disabled={
                isSyncingContactPhone ||
                !(
                  (syncContactPhoneDialog?.syncToOpportunity && syncContactPhoneDialog?.opportunityId) ||
                  (syncContactPhoneDialog?.syncToLead && syncContactPhoneDialog?.leadId)
                )
              }
            >
              {isSyncingContactPhone ? "同步中…" : "同步"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
