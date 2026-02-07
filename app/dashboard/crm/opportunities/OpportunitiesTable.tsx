"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAlert } from "@/hooks/use-alert";
import { useFilter } from "@/hooks/use-filter";
import { FilterDialog, type FilterField } from "@/components/ui/filter-dialog";
import { OpportunityStatusSelect } from "./OpportunityStatusSelect";
import { OpportunitySalesPersonSelect } from "./OpportunitySalesPersonSelect";
import { FollowUpTimeline } from "../components/FollowUpTimeline";
import { WriteFollowUpDialog } from "../components/WriteFollowUpDialog";
import { createManualFollowUpAction, updateOpportunityAction, syncContactPhoneToLeadAction, syncLeadContactPhoneToCustomerAction } from "@/app/lib/crm-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, MessageSquarePlus, User, ExternalLink, Filter, MoreHorizontal, X, Check, UserRound, Building2 } from "lucide-react";
import { OPPORTUNITY_STATUS } from "@/app/lib/crm-constants";
import { cn } from "@/lib/utils";

type Opportunity = {
  id: string;
  name: string;
  productType: string | null;
  status: string;
  amount: any;
  contactPhone: string | null;
  createdAt: Date;
  expectedCloseDate: Date | null;
  lostReason: string | null;
  salesPersonId: string | null;
  deliveryPersonId: string | null;
  leadId: string | null;
  salesPerson: { id: string; name: string } | null;
  deliveryPerson: { id: string; name: string } | null;
  lead: { id: string; customerName: string; contactPhone: string | null } | null;
  customer: { id: string; name: string } | null;
};

type User = { id: string; name: string };

interface EditingState {
  oppId: string;
  field: string;
  value: string;
}

export function OpportunitiesTable({
  opportunities,
  currentUserRole,
  users = [],
  highlightId,
}: {
  opportunities: Opportunity[];
  currentUserRole?: string;
  users?: User[];
  highlightId?: string;
}) {
  const router = useRouter();
  const { showAlert, AlertComponent } = useAlert();
  const [expandedOppIds, setExpandedOppIds] = useState<Set<string>>(new Set());
  const [writeFollowUpOppId, setWriteFollowUpOppId] = useState<string | null>(null);
  const [followUpRefreshKeys, setFollowUpRefreshKeys] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  // 细粒度保存状态：Set<"oppId:field">
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState(opportunities);
  const [filterOpen, setFilterOpen] = useState(false);
  /** 商机表修改联系方式成功后，弹框选择同步到线索表/客户表 */
  const [syncContactPhoneDialog, setSyncContactPhoneDialog] = useState<{
    newValue: string;
    leadId?: string;
    customerId?: string;
    syncToLead: boolean;
    syncToCustomer: boolean;
  } | null>(null);
  const [isSyncingContactPhone, setIsSyncingContactPhone] = useState(false);

  // 定义筛选字段
  const filterFields: FilterField[] = [
    { key: "name", label: "商机名称", type: "text" },
    { key: "productType", label: "产品类型", type: "text" },
    { key: "status", label: "状态", type: "select", options: OPPORTUNITY_STATUS.map(s => ({ value: s, label: s })) },
    { key: "amount", label: "金额", type: "number" },
    { key: "expectedCloseDate", label: "预计成交日期", type: "date" },
    { key: "salesPerson.name", label: "销售人员", type: "text" },
    { key: "deliveryPerson.name", label: "交付人员", type: "text" },
    { key: "createdAt", label: "创建时间", type: "date" },
  ];

  // 使用筛选 Hook
  const { filteredData, conditions, applyFilter, clearFilter, hasActiveFilters } = useFilter(rows, filterFields);

  // 更新 rows 时同步更新筛选结果
  useEffect(() => {
    setRows(opportunities);
  }, [opportunities]);

  // 自动展开高亮的商机
  useEffect(() => {
    if (highlightId) {
      setExpandedOppIds((prev) => new Set(prev).add(highlightId));
      setTimeout(() => {
        const row = document.getElementById(`opp-row-${highlightId}`);
        if (row) {
          row.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  }, [highlightId]);

  const toggleExpandedOpp = (id: string) => {
    setExpandedOppIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    setRows(opportunities);
  }, [opportunities]);

  const handleWriteFollowUp = async (data: {
    content: string;
    contactPerson?: string;
    summary?: string;
    nextStep?: string;
    customerNeeds?: string;
  }) => {
    if (!writeFollowUpOppId) return;

    setIsSubmitting(true);
    try {
      const result = await createManualFollowUpAction({
        opportunityId: writeFollowUpOppId,
        ...data,
      });
      if (result?.error) {
        showAlert(result.error, { type: "error", title: "操作失败" });
      } else {
        const oppIdJustSubmitted = writeFollowUpOppId;
        setWriteFollowUpOppId(null);
        setFollowUpRefreshKeys((prev) => ({
          ...prev,
          [oppIdJustSubmitted]: (prev[oppIdJustSubmitted] ?? 0) + 1,
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

  const startEdit = (oppId: string, field: string, currentValue: string | null) => {
    setEditing({ oppId, field, value: currentValue ?? "" });
  };

  const cancelEdit = () => {
    setEditing(null);
  };

  const saveEdit = async () => {
    if (!editing) return;

    const opp = rows.find(o => o.id === editing.oppId);
    if (!opp) return;

    // 检查是否有变化
    const currentValue = getFieldValue(opp, editing.field);
    if (editing.value === currentValue) {
      setEditing(null);
      return;
    }

    const fieldKey = `${editing.oppId}:${editing.field}`;

    // 如果该字段正在保存，直接返回（避免重复保存）
    if (savingFields.has(fieldKey)) return;

    const prevRow = opp;
    const editingField = editing.field;
    const editingOppId = editing.oppId;
    const editingValue = editing.value;

    // 乐观更新：立即更新UI
    let nextValue: any = editing.value;
    let nextSalesPerson = opp.salesPerson;
    let nextDeliveryPerson = opp.deliveryPerson;
    if (editing.field === "amount") {
      nextValue = editing.value ? Number(editing.value) : null;
    } else if (editing.field === "expectedCloseDate") {
      nextValue = editing.value ? new Date(editing.value) : null;
    } else if (editing.field === "salesPersonId" || editing.field === "deliveryPersonId") {
      nextValue = editing.value || null;
      if (editing.field === "salesPersonId") {
        nextSalesPerson = nextValue
          ? users.find((u) => u.id === nextValue) ?? null
          : null;
      } else {
        nextDeliveryPerson = nextValue
          ? users.find((u) => u.id === nextValue) ?? null
          : null;
      }
    }

    setRows((prev) =>
      prev.map((o) =>
        o.id === editing.oppId
          ? {
            ...o,
            [editing.field]: nextValue,
            salesPerson: nextSalesPerson,
            deliveryPerson: nextDeliveryPerson,
          }
          : o
      )
    );

    // 标记为保存中
    setSavingFields((prev) => new Set(prev).add(fieldKey));

    // 关闭编辑框，允许用户继续编辑其他字段
    setEditing(null);

    // 异步保存（完全异步，不阻塞）
    try {
      const formData = new FormData();
      formData.append("opportunityId", editingOppId);
      formData.append("inline", "1");

      // 保留现有值
      formData.append("name", opp.name);
      formData.append("productType", opp.productType ?? "");
      formData.append("status", opp.status);
      formData.append("amount", opp.amount ? String(opp.amount) : "");
      formData.append("contactPhone", opp.contactPhone ?? "");
      formData.append("expectedCloseDate", opp.expectedCloseDate ? opp.expectedCloseDate.toISOString().split("T")[0] : "");
      formData.append("salesPersonId", opp.salesPersonId ?? "");
      formData.append("deliveryPersonId", opp.deliveryPersonId ?? "");

      // 更新编辑的字段
      formData.set(editingField, editingValue);

      const result = await updateOpportunityAction(null, formData);

      if (result?.error) {
        // 保存失败，回滚UI
        setRows((prev) =>
          prev.map((o) => (o.id === prevRow.id ? prevRow : o))
        );
        showAlert(result.error, { type: "error", title: "操作失败" });
      } else {
        if (editingField === "contactPhone" && (prevRow.lead || prevRow.customer)) {
          setSyncContactPhoneDialog({
            newValue: editingValue.trim(),
            leadId: prevRow.lead?.id,
            customerId: prevRow.customer?.id,
            syncToLead: !!prevRow.lead,
            syncToCustomer: !!prevRow.customer,
          });
        } else {
          router.refresh();
        }
      }
    } catch (error) {
      console.error("保存失败:", error);
      // 保存失败，回滚UI
      setRows((prev) =>
        prev.map((o) => (o.id === prevRow.id ? prevRow : o))
      );
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

  const getFieldValue = (opp: Opportunity, field: string): string => {
    switch (field) {
      case "name": return opp.name;
      case "productType": return opp.productType ?? "";
      case "amount": return opp.amount ? String(opp.amount) : "";
      case "contactPhone": return opp.contactPhone ?? "";
      case "expectedCloseDate": return opp.expectedCloseDate ? opp.expectedCloseDate.toISOString().split("T")[0] : "";
      case "salesPersonId": return opp.salesPersonId ?? "";
      case "deliveryPersonId": return opp.deliveryPersonId ?? "";
      default: return "";
    }
  };

  const renderEditableCell = (
    opp: Opportunity,
    field: string,
    displayValue: string,
    type: "text" | "number" | "date" | "select" = "text",
    selectOptions?: { value: string; label: string }[]
  ) => {
    const isEditing = editing?.oppId === opp.id && editing?.field === field;
    const fieldKey = `${opp.id}:${field}`;
    const isSaving = savingFields.has(fieldKey);

    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          {type === "select" && selectOptions ? (
            <select
              autoFocus
              value={editing.value}
              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              className="h-8 min-w-[60px] w-full rounded border border-primary bg-white px-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isSaving}
            >
              {selectOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <Input
              autoFocus
              type={type}
              value={editing.value}
              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              className="h-8 border-primary text-left"
              disabled={isSaving}
            />
          )}
        </div>
      );
    }

    return (
      <div
        onClick={() => {
          if (!isSaving) {
            startEdit(opp.id, field, getFieldValue(opp, field));
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

  const currentWriteFollowUpOpp = rows.find(
    (o) => o.id === writeFollowUpOppId
  );

  const isAdmin = currentUserRole === "admin";

  const userOptions = [
    { value: "", label: "未指定" },
    ...users.map((u) => ({ value: u.id, label: u.name })),
  ];

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
              <th className="px-4 py-3 text-center font-medium">商机名称</th>
              <th className="px-4 py-3 text-center font-medium">产品类型</th>
              <th className="px-4 py-3 text-center font-medium">商机金额</th>
              <th className="px-4 py-3 text-center font-medium">联系方式</th>
              <th className="px-4 py-3 text-center font-medium">创建日期</th>
              <th className="px-4 py-3 text-center font-medium">预计赢单日期</th>
              <th className="px-4 py-3 text-center font-medium">销售人员</th>
              <th className="px-4 py-3 text-center font-medium">交付负责人</th>
              <th className="px-4 py-3 text-center font-medium">状态</th>
              <th className="px-4 py-3 text-center font-medium" title="该列可点击跳转到线索并高亮">
                来源线索
              </th>
              <th className="px-4 py-3 text-center font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="[&_td]:text-center">
            {opportunities.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  暂无数据。将线索状态改为「有意向」后，商机会自动生成并出现在此处
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  没有符合筛选条件的数据
                </td>
              </tr>
            ) : (
              filteredData.map((opp) => (
                <Fragment key={opp.id}>
                  <tr
                    id={`opp-row-${opp.id}`}
                    className={`border-b last:border-0 hover:bg-muted/30 ${highlightId === opp.id ? "animate-highlight-row" : ""
                      }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleExpandedOpp(opp.id)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {expandedOppIds.has(opp.id) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {renderEditableCell(opp, "name", opp.name)}
                    </td>
                    <td className="px-4 py-3">
                      {renderEditableCell(opp, "productType", opp.productType ?? "-")}
                    </td>
                    <td className="px-4 py-3">
                      {renderEditableCell(
                        opp,
                        "amount",
                        opp.amount != null
                          ? `¥${Number(opp.amount).toLocaleString()}`
                          : "-",
                        "number"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {renderEditableCell(
                        opp,
                        "contactPhone",
                        opp.contactPhone ?? opp.lead?.contactPhone ?? "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {opp.createdAt.toLocaleDateString("zh-CN")}
                    </td>
                    <td className="px-4 py-3">
                      {renderEditableCell(
                        opp,
                        "expectedCloseDate",
                        opp.expectedCloseDate
                          ? opp.expectedCloseDate.toLocaleDateString("zh-CN")
                          : "-",
                        "date"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <OpportunitySalesPersonSelect
                        opportunityId={opp.id}
                        opportunityName={opp.name}
                        currentSalesPersonId={opp.salesPersonId}
                        users={users}
                        canAssign={isAdmin}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {renderEditableCell(
                        opp,
                        "deliveryPersonId",
                        opp.deliveryPerson?.name ?? "-",
                        "select",
                        userOptions
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <OpportunityStatusSelect
                        opportunityId={opp.id}
                        currentStatus={opp.status}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {opp.lead ? (
                        <Link
                          href={`/dashboard/crm/leads?highlight=${opp.lead.id}`}
                          className="inline-flex items-center justify-center gap-1 text-primary underline decoration-primary/50 hover:decoration-primary cursor-pointer"
                          title="点击跳转到线索并高亮"
                        >
                          {opp.lead.customerName}
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
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
                          onClick={() => setWriteFollowUpOppId(opp.id)}
                        >
                          <MessageSquarePlus className="h-3.5 w-3.5" />
                          写跟进
                        </Button>
                        {opp.customer && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/dashboard/crm/customers?highlight=${opp.customer.id}`}
                                >
                                  <User />
                                  查看客户
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedOppIds.has(opp.id) && (
                    <tr>
                      <td colSpan={12} className="bg-gray-50 px-4 py-4 !text-left">
                        <div className="rounded-lg border border-gray-200 bg-white p-4 text-left">
                          <h4 className="mb-3 font-semibold text-gray-900 text-left">
                            跟进时间线
                          </h4>
                          <FollowUpTimeline
                            opportunityId={opp.id}
                            currentUserRole={currentUserRole}
                            refreshKey={followUpRefreshKeys[opp.id] ?? 0}
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
      {currentWriteFollowUpOpp && (
        <WriteFollowUpDialog
          isOpen={!!writeFollowUpOppId}
          onClose={() => setWriteFollowUpOppId(null)}
          onConfirm={handleWriteFollowUp}
          recordType="商机"
          recordName={currentWriteFollowUpOpp.name}
          isSubmitting={isSubmitting}
        />
      )}

      {/* 联系方式同步到线索表/客户表 */}
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
              {syncContactPhoneDialog.customerId && (
                <button
                  type="button"
                  onClick={() =>
                    setSyncContactPhoneDialog((prev) =>
                      prev ? { ...prev, syncToCustomer: !prev.syncToCustomer } : prev
                    )
                  }
                  className={cn(
                    "flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                    syncContactPhoneDialog.syncToCustomer
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-muted bg-muted/30 text-muted-foreground hover:border-muted-foreground/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      syncContactPhoneDialog.syncToCustomer
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40"
                    )}
                  >
                    {syncContactPhoneDialog.syncToCustomer ? (
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    ) : null}
                  </span>
                  <Building2 className="h-5 w-5 shrink-0" />
                  <span className="font-medium">客户表</span>
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
              仅更新商机表
            </Button>
            <Button
              type="button"
              onClick={async () => {
                const d = syncContactPhoneDialog;
                if (!d) return;
                setIsSyncingContactPhone(true);
                try {
                  const tasks: Promise<{ error?: string } | null>[] = [];
                  if (d.syncToLead && d.leadId)
                    tasks.push(syncContactPhoneToLeadAction(d.leadId, d.newValue));
                  if (d.syncToCustomer && d.customerId)
                    tasks.push(syncLeadContactPhoneToCustomerAction(d.customerId, d.newValue));
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
                  if (d.syncToLead && d.leadId) parts.push("线索表");
                  if (d.syncToCustomer && d.customerId) parts.push("客户表");
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
                  (syncContactPhoneDialog?.syncToLead && syncContactPhoneDialog?.leadId) ||
                  (syncContactPhoneDialog?.syncToCustomer && syncContactPhoneDialog?.customerId)
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
