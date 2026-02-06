"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CustomerStatusSelect } from "./CustomerStatusSelect";
import { FollowUpTimeline } from "../components/FollowUpTimeline";
import { WriteFollowUpDialog } from "../components/WriteFollowUpDialog";
import { createManualFollowUpAction, updateCustomerAction } from "@/app/lib/crm-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, MessageSquarePlus } from "lucide-react";

type Customer = {
  id: string;
  name: string;
  nickname: string | null;
  city: string | null;
  customerTier: string | null;
  industry: string | null;
  firstMaintenanceDate: Date | null;
  status: string;
  salesPersonId: string | null;
  salesPerson: { id: string; name: string } | null;
  opportunity: { id: string; name: string } | null;
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
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Set<string>>(new Set());
  const [writeFollowUpCustomerId, setWriteFollowUpCustomerId] = useState<string | null>(null);
  const [followUpRefreshKeys, setFollowUpRefreshKeys] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState(customers);

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
        alert(result.error);
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
      alert("添加跟进记录失败");
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
      default:
        return "";
    }
  };

  const saveCustomerEdit = async () => {
    if (saving) return;
    if (!editing) return;
    const customer = rows.find((c) => c.id === editing.customerId);
    if (!customer) return;
    const current = getCustomerFieldValue(customer, editing.field);
    if (editing.value === current) {
      setEditing(null);
      return;
    }
    setSaving(true);
    const prevRow = customer;
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
    setEditing(null);
    try {
      const formData = new FormData();
      formData.append("customerId", editing.customerId);
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
      formData.set(editing.field, editing.value);
      const result = await updateCustomerAction(null, formData);
      if (result?.error) {
        alert(result.error);
        setRows((prev) => prev.map((c) => (c.id === prevRow.id ? prevRow : c)));
      } else {
        router.refresh();
      }
    } catch (e) {
      console.error(e);
      alert("保存失败");
      setRows((prev) => prev.map((c) => (c.id === prevRow.id ? prevRow : c)));
    } finally {
      setSaving(false);
    }
  };

  const canEditCustomer = (customer: Customer) =>
    isAdmin || (currentUserId != null && customer.salesPersonId === currentUserId);

  const renderCustomerCell = (
    customer: Customer,
    field: string,
    displayValue: string,
    type: "text" | "date" = "text"
  ) => {
    if (!canEditCustomer(customer)) return <>{displayValue || "-"}</>;
    const isEditing = editing?.customerId === customer.id && editing?.field === field;
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
          disabled={saving}
        />
      );
    }
    return (
      <div
        onClick={() =>
          setEditing({
            customerId: customer.id,
            field,
            value: getCustomerFieldValue(customer, field),
          })
        }
        className="cursor-pointer rounded px-2 py-1 hover:bg-blue-50"
        title="点击编辑"
      >
        {displayValue || <span className="text-muted-foreground">-</span>}
      </div>
    );
  };

  const currentWriteFollowUpCustomer = rows.find(
    (c) => c.id === writeFollowUpCustomerId
  );

  return (
    <>
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
              <th className="px-4 py-3 font-medium">初次维护日期</th>
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
                  colSpan={11}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  暂无数据，点击「新建客户」添加，或从商机转入
                </td>
              </tr>
            ) : (
              rows.map((customer) => (
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
