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
import { createManualFollowUpAction, updateCustomerAction } from "@/app/lib/crm-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, MessageSquarePlus, Filter, X } from "lucide-react";
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
  opportunity: { id: string; name: string; lead: { contactPhone: string | null } | null } | null;
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
        // 保存成功，刷新数据
        router.refresh();
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
          className="h-8 border-primary"
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
          "flex items-center gap-1 rounded px-2 py-1",
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
              <th className="w-10 px-4 py-3 font-medium"></th>
              <th className="px-4 py-3 font-medium">客户名称</th>
              <th className="px-4 py-3 font-medium">昵称</th>
              <th className="px-4 py-3 font-medium">城市</th>
              <th className="px-4 py-3 font-medium">客户分层</th>
              <th className="px-4 py-3 font-medium">行业</th>
              <th className="px-4 py-3 font-medium">联系方式</th>
              <th className="px-4 py-3 font-medium">初次维护日期</th>
              <th className="px-4 py-3 font-medium">实际成交金额</th>
              <th className="px-4 py-3 font-medium">销售人员</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">来源商机</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
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
                    className={`border-b last:border-0 hover:bg-muted/30 ${highlightId === customer.id ? "bg-yellow-50" : ""}`}
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
                      {customer.contactPhone ?? customer.opportunity?.lead?.contactPhone ?? "-"}
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
                      <div className="flex flex-wrap items-center gap-1.5">
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
                      <td colSpan={11} className="bg-gray-50 px-4 py-4">
                        <div className="rounded-lg border border-gray-200 bg-white p-4">
                          <h4 className="mb-3 font-semibold text-gray-900">
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

      {highlightId && (
        <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          当前高亮：从商机表「查看客户」跳转
        </div>
      )}
    </>
  );
}
