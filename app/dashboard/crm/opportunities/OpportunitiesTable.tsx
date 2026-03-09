"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SheetScrollArea } from "@/components/ui/sheet-scroll-area";
import { ChevronDown, ChevronUp, MessageSquarePlus, User, ExternalLink, Filter, MoreHorizontal, X, Check, UserRound, Building2, Star, FileText, ArrowUpDown } from "lucide-react";
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
  isKeyFocus?: boolean;
  keyFocusByAdmin?: boolean;
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
  currentUserId,
  users = [],
  highlightId,
  sortBy,
  sortOrder,
}: {
  opportunities: Opportunity[];
  currentUserRole?: string;
  currentUserId?: string;
  users?: User[];
  highlightId?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  /** 查看详细记录：右侧滑层展示的商机 id */
  const [detailOppId, setDetailOppId] = useState<string | null>(null);
  /** 多选仅作结构一致（与线索表对齐），无批量操作 */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 定义筛选字段 - 包含商机表的所有有意义的字段
  const filterFields: FilterField[] = [
    { key: "name", label: "商机名称", type: "text" },
    { key: "productType", label: "产品类型", type: "text" },
    { key: "status", label: "状态", type: "select", options: OPPORTUNITY_STATUS.map(s => ({ value: s, label: s })) },
    { key: "amount", label: "金额", type: "number" },
    { key: "contactPhone", label: "联系方式", type: "text" },
    { key: "expectedCloseDate", label: "预计成交日期", type: "date" },
    { key: "lostReason", label: "丢单原因", type: "text" },
    { key: "salesPerson.name", label: "销售人员", type: "text" },
    { key: "deliveryPerson.name", label: "交付人员", type: "text" },
    { key: "lead.customerName", label: "来源线索", type: "text" },
    { key: "isKeyFocus", label: "重点关注", type: "boolean" },
    { key: "keyFocusByAdmin", label: "管理员标注", type: "boolean" },
    { key: "createdAt", label: "创建时间", type: "date" },
  ];

  // 使用筛选 Hook
  const { filteredData, conditions, groups, applyFilter, clearFilter, hasActiveFilters, activeFilterCount } = useFilter(rows, filterFields);

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

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allFilteredSelected = filteredData.length > 0 && filteredData.every((o) => selectedIds.has(o.id));
  const toggleSelectAll = () => {
    if (allFilteredSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredData.map((o) => o.id)));
  };

  const buildUrl = (updates: { page?: number; sortBy?: string; sortOrder?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.page != null) params.set("page", String(updates.page));
    if (updates.sortBy !== undefined) {
      if (updates.sortBy) params.set("sortBy", updates.sortBy);
      else params.delete("sortBy");
    }
    if (updates.sortOrder !== undefined) {
      if (updates.sortOrder) params.set("sortOrder", updates.sortOrder);
      else params.delete("sortOrder");
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const handleSortChange = (value: string) => {
    const [by, order] = value.split("-") as [string, string];
    router.replace(buildUrl({ page: 1, sortBy: by, sortOrder: order }), { scroll: false });
  };

  useEffect(() => {
    setRows(opportunities);
  }, [opportunities]);

  const handleWriteFollowUp = async (
    data: {
      content: string;
      contactPerson?: string;
      summary?: string;
      nextStep?: string;
      customerNeeds?: string;
    },
    files?: File[]
  ) => {
    if (!writeFollowUpOppId) return;

    setIsSubmitting(true);
    try {
      const result = await createManualFollowUpAction({
        opportunityId: writeFollowUpOppId,
        ...data,
      });
      if (result?.error) {
        showAlert(result.error, { type: "error", title: "操作失败" });
        return;
      }
      const followUpId = (result as { followUpId?: string })?.followUpId;
      if (followUpId && files?.length) {
        for (const file of files) {
          const formData = new FormData();
          formData.set("file", file);
          const res = await fetch(
            `/api/crm/follow-ups/${followUpId}/images/upload`,
            { method: "POST", body: formData }
          );
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showAlert(err.error ?? "上传图片失败", { type: "error", title: "操作失败" });
            return;
          }
        }
      }
      const oppIdJustSubmitted = writeFollowUpOppId;
      setWriteFollowUpOppId(null);
      setFollowUpRefreshKeys((prev) => ({
        ...prev,
        [oppIdJustSubmitted]: (prev[oppIdJustSubmitted] ?? 0) + 1,
      }));
      router.refresh();
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

  /** 与线索表一致的列内文案最大宽度（截断显示） */
  const getFieldTextMaxWidthClass = (field: string) => {
    switch (field) {
      case "name": return "max-w-[135px]";
      case "productType": return "max-w-[110px]";
      case "amount": return "max-w-[110px]";
      case "contactPhone": return "max-w-[130px]";
      case "expectedCloseDate": return "max-w-[110px]";
      case "salesPersonId":
      case "deliveryPersonId": return "max-w-[130px]";
      default: return "max-w-[140px]";
    }
  };

  const renderEditableCell = (
    opp: Opportunity,
    field: string,
    displayValue: string,
    type: "text" | "number" | "date" | "select" = "text",
    selectOptions?: { value: string; label: string }[],
    options?: { align?: "left" | "center" }
  ) => {
    const isEditing = editing?.oppId === opp.id && editing?.field === field;
    const fieldKey = `${opp.id}:${field}`;
    const isSaving = savingFields.has(fieldKey);

    if (isEditing) {
      return (
        <div className="flex w-full items-center gap-1">
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

    const alignLeft = options?.align === "left";
    return (
      <div
        onClick={() => {
          if (!isSaving) {
            startEdit(opp.id, field, getFieldValue(opp, field));
          }
        }}
        className={cn(
          "flex w-full items-center gap-1 rounded px-2 py-1",
          alignLeft ? "justify-start text-left" : "justify-center",
          isSaving ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-blue-50"
        )}
        title={isSaving ? "保存中..." : (displayValue || "点击编辑")}
      >
        {displayValue ? (
          <span
            className={cn(
              "inline-block w-full min-w-0 truncate whitespace-nowrap align-middle",
              getFieldTextMaxWidthClass(field)
            )}
            title={displayValue}
          >
            {displayValue}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
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
                {activeFilterCount}
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
          {sortBy != null && sortOrder != null && (
            <Select
              value={`${sortBy}-${sortOrder}`}
              onValueChange={handleSortChange}
            >
              <SelectTrigger className="h-8 min-w-[220px] gap-2">
                <ArrowUpDown className="h-4 w-4 shrink-0" />
                <SelectValue placeholder="排序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt-desc">默认（创建时间新→旧）</SelectItem>
                <SelectItem value="name-asc">商机名称 A→Z</SelectItem>
                <SelectItem value="name-desc">商机名称 Z→A</SelectItem>
                <SelectItem value="createdAt-asc">创建时间 旧→新</SelectItem>
                <SelectItem value="productType-asc">产品类型 A→Z</SelectItem>
                <SelectItem value="productType-desc">产品类型 Z→A</SelectItem>
                <SelectItem value="status-asc">状态 A→Z</SelectItem>
                <SelectItem value="status-desc">状态 Z→A</SelectItem>
                <SelectItem value="expectedCloseDate-desc">预计赢单日期 新→旧</SelectItem>
                <SelectItem value="expectedCloseDate-asc">预计赢单日期 旧→新</SelectItem>
                <SelectItem value="amount-desc">金额 高→低</SelectItem>
                <SelectItem value="amount-asc">金额 低→高</SelectItem>
              </SelectContent>
            </Select>
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
        groups={groups}
        onApply={applyFilter}
        onClear={clearFilter}
      />

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="min-w-[980px] w-full table-fixed text-left text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="w-10 px-4 py-3 text-center font-medium">
                {filteredData.length > 0 ? (
                  <label className="flex cursor-pointer items-center justify-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-input"
                      title={allFilteredSelected ? "取消全选" : "全选当前页"}
                    />
                    <span className="sr-only">{allFilteredSelected ? "取消全选" : "全选当前页"}</span>
                  </label>
                ) : null}
              </th>
              <th className="w-[170px] px-4 py-3 text-center font-medium">商机名称</th>
              <th className="w-[110px] px-4 py-3 text-center font-medium">产品类型</th>
              <th className="w-[120px] px-4 py-3 text-center font-medium">商机金额</th>
              <th className="w-[130px] px-4 py-3 text-center font-medium">联系方式</th>
              <th className="w-[120px] px-4 py-3 text-center font-medium">创建日期</th>
              <th className="w-[120px] px-4 py-3 text-center font-medium">预计赢单日期</th>
              <th className="w-[130px] px-4 py-3 text-center font-medium">销售人员</th>
              <th className="w-[130px] px-4 py-3 text-center font-medium">交付负责人</th>
              <th className="w-[110px] px-4 py-3 text-center font-medium">状态</th>
              <th className="w-[120px] px-4 py-3 text-center font-medium" title="该列可点击跳转到线索并高亮">
                来源线索
              </th>
              <th className="w-[130px] px-4 py-3 text-center font-medium">操作</th>
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
                    className={`border-b last:border-0 hover:bg-muted/30 ${highlightId === opp.id ? "animate-highlight-row" : ""} ${selectedIds.has(opp.id) ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <label className="flex cursor-pointer items-center justify-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(opp.id)}
                          onChange={() => toggleSelectOne(opp.id)}
                          className="h-4 w-4 rounded border-input"
                          title={selectedIds.has(opp.id) ? "取消选择" : "选择"}
                        />
                        <span className="sr-only">{selectedIds.has(opp.id) ? "取消选择" : "选择"}</span>
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <div className="relative inline-flex items-center">
                          {opp.isKeyFocus && (
                            <span
                              className="absolute right-full mr-0.5 top-1/2 -translate-y-1/2"
                              title={opp.keyFocusByAdmin ? "管理员标记为重点" : "重点关注"}
                              aria-hidden
                            >
                              <Star
                                className={cn(
                                  "h-4 w-4",
                                  opp.keyFocusByAdmin ? "fill-blue-500 text-blue-500" : "fill-amber-400 text-amber-500"
                                )}
                              />
                            </span>
                          )}
                          {renderEditableCell(opp, "name", opp.name)}
                        </div>
                      </div>
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
                        onOptimisticUpdate={(newId) =>
                          setRows((prev) =>
                            prev.map((r) =>
                              r.id === opp.id
                                ? {
                                  ...r,
                                  salesPersonId: newId ?? null,
                                  salesPerson: newId ? users.find((u) => u.id === newId) ?? null : null,
                                }
                                : r
                            )
                          )
                        }
                        onRevert={(prevId) =>
                          setRows((prev) =>
                            prev.map((r) =>
                              r.id === opp.id
                                ? {
                                  ...r,
                                  salesPersonId: prevId ?? null,
                                  salesPerson: prevId ? users.find((u) => u.id === prevId) ?? null : null,
                                }
                                : r
                            )
                          )
                        }
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
                        onOptimisticUpdate={(newStatus) =>
                          setRows((prev) =>
                            prev.map((r) => (r.id === opp.id ? { ...r, status: newStatus } : r))
                          )
                        }
                        onRevert={(prevStatus) =>
                          setRows((prev) =>
                            prev.map((r) => (r.id === opp.id ? { ...r, status: prevStatus } : r))
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {opp.lead ? (
                        <Link
                          href={`/dashboard/crm/leads?highlight=${opp.lead.id}`}
                          className="inline-flex max-w-[120px] items-center justify-center gap-1 truncate text-primary underline decoration-primary/50 hover:decoration-primary cursor-pointer"
                          title={opp.lead.customerName || "点击跳转到线索并高亮"}
                        >
                          <span className="min-w-0 truncate">{opp.lead.customerName}</span>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailOppId(opp.id)}>
                              <FileText className="mr-2 h-4 w-4" />
                              查看详细记录
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleExpandedOpp(opp.id)}>
                              <ChevronDown className="mr-2 h-4 w-4" />
                              {expandedOppIds.has(opp.id) ? "收起跟进时间线" : "展开跟进时间线"}
                            </DropdownMenuItem>
                            {opp.customer && (
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/dashboard/crm/customers?highlight=${opp.customer.id}`}
                                >
                                  <User className="mr-2 h-4 w-4" />
                                  查看客户
                                </Link>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                  {expandedOppIds.has(opp.id) && (
                    <tr>
                      <td colSpan={12} className="bg-gray-50 px-4 py-4 !text-left">
                        <div className="rounded-lg border border-gray-200 bg-white p-4 text-left">
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="font-semibold text-gray-900 text-left">
                              跟进时间线
                            </h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                              onClick={() => toggleExpandedOpp(opp.id)}
                            >
                              <ChevronUp className="h-4 w-4" />
                              收起
                            </Button>
                          </div>
                          <FollowUpTimeline
                            opportunityId={opp.id}
                            currentUserRole={currentUserRole}
                            currentUserId={currentUserId}
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

      {/* 查看详细记录：右侧滑层 */}
      <Sheet open={!!detailOppId} onOpenChange={(open) => !open && setDetailOppId(null)}>
        <SheetContent side="right" className="flex flex-col overflow-hidden">
          {(() => {
            const opp = detailOppId ? rows.find((o) => o.id === detailOppId) : null;
            if (!opp) return null;
            return (
              <>
                <SheetHeader className="shrink-0 border-b pb-3 text-left">
                  <SheetTitle>商机详情 · {opp.name}</SheetTitle>
                </SheetHeader>
                <SheetScrollArea>
                  <div className="space-y-1.5 text-left">
                    <div className="text-xs font-medium text-muted-foreground">商机名称</div>
                    {/* 输入框最大宽度：改此处的 max-w-sm 即可，如 max-w-md / max-w-lg */}
                    <div className="min-h-[32px] flex items-center text-sm justify-start text-left w-full max-w-sm pl-1">
                      {renderEditableCell(opp, "name", opp.name, "text", undefined, { align: "left" })}
                    </div>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <div className="text-xs font-medium text-muted-foreground">产品类型</div>
                    <div className="min-h-[32px] flex items-center text-sm justify-start text-left w-full max-w-sm pl-1">
                      {renderEditableCell(opp, "productType", opp.productType ?? "-", "text", undefined, { align: "left" })}
                    </div>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <div className="text-xs font-medium text-muted-foreground">商机金额</div>
                    <div className="min-h-[32px] flex items-center text-sm justify-start text-left w-full max-w-sm pl-1">
                      {renderEditableCell(
                        opp,
                        "amount",
                        opp.amount != null ? `¥${Number(opp.amount).toLocaleString()}` : "-",
                        "number",
                        undefined,
                        { align: "left" }
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <div className="text-xs font-medium text-muted-foreground">联系方式</div>
                    <div className="min-h-[32px] flex items-center text-sm justify-start text-left w-full max-w-sm pl-1">
                      {renderEditableCell(
                        opp,
                        "contactPhone",
                        opp.contactPhone ?? opp.lead?.contactPhone ?? "-",
                        "text",
                        undefined,
                        { align: "left" }
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <div className="text-xs font-medium text-muted-foreground">创建时间</div>
                    <div className="min-h-[32px] flex items-center text-sm justify-start text-left w-full max-w-sm pl-1">
                      <span className="text-muted-foreground">
                        {opp.createdAt.toLocaleString("zh-CN")}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <div className="text-xs font-medium text-muted-foreground">预计赢单日期</div>
                    <div className="min-h-[32px] flex items-center text-sm justify-start text-left w-full max-w-sm pl-1">
                      {renderEditableCell(
                        opp,
                        "expectedCloseDate",
                        opp.expectedCloseDate
                          ? opp.expectedCloseDate.toLocaleDateString("zh-CN")
                          : "-",
                        "date",
                        undefined,
                        { align: "left" }
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <div className="text-xs font-medium text-muted-foreground">丢单原因</div>
                    <div className="min-h-[32px] flex items-center text-sm justify-start text-left w-full max-w-sm pl-1">
                      <span>{opp.lostReason ?? "-"}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <div className="text-xs font-medium text-muted-foreground">销售人员</div>
                    <div className="min-h-[32px] flex items-center text-sm justify-start text-left w-full max-w-sm pl-1">
                      <OpportunitySalesPersonSelect
                        opportunityId={opp.id}
                        opportunityName={opp.name}
                        currentSalesPersonId={opp.salesPersonId}
                        users={users}
                        canAssign={isAdmin}
                        onOptimisticUpdate={(newId) =>
                          setRows((prev) =>
                            prev.map((r) =>
                              r.id === opp.id
                                ? {
                                  ...r,
                                  salesPersonId: newId ?? null,
                                  salesPerson: newId ? users.find((u) => u.id === newId) ?? null : null,
                                }
                                : r
                            )
                          )
                        }
                        onRevert={(prevId) =>
                          setRows((prev) =>
                            prev.map((r) =>
                              r.id === opp.id
                                ? {
                                  ...r,
                                  salesPersonId: prevId ?? null,
                                  salesPerson: prevId ? users.find((u) => u.id === prevId) ?? null : null,
                                }
                                : r
                            )
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <div className="text-xs font-medium text-muted-foreground">交付负责人</div>
                    <div className="min-h-[32px] flex items-center text-sm justify-start text-left w-full max-w-sm pl-1">
                      {renderEditableCell(
                        opp,
                        "deliveryPersonId",
                        opp.deliveryPerson?.name ?? "-",
                        "select",
                        userOptions,
                        { align: "left" }
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <div className="text-xs font-medium text-muted-foreground">状态</div>
                    <div className="min-h-[32px] flex items-center text-sm justify-start text-left w-full max-w-sm pl-1">
                      <OpportunityStatusSelect
                        opportunityId={opp.id}
                        currentStatus={opp.status}
                        onOptimisticUpdate={(newStatus) =>
                          setRows((prev) =>
                            prev.map((r) => (r.id === opp.id ? { ...r, status: newStatus } : r))
                          )
                        }
                        onRevert={(prevStatus) =>
                          setRows((prev) =>
                            prev.map((r) => (r.id === opp.id ? { ...r, status: prevStatus } : r))
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <div className="text-xs font-medium text-muted-foreground">来源线索</div>
                    <div className="min-h-[32px] flex items-center text-sm justify-start text-left w-full max-w-sm pl-1">
                      {opp.lead ? (
                        <Link
                          href={`/dashboard/crm/leads?highlight=${opp.lead.id}`}
                          className="text-primary underline decoration-primary/50 hover:decoration-primary"
                        >
                          {opp.lead.customerName}
                          <ExternalLink className="ml-1 inline h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t">
                    <h4 className="mb-3 text-sm font-semibold text-foreground">跟进时间线</h4>
                    <FollowUpTimeline
                      opportunityId={opp.id}
                      currentUserRole={currentUserRole}
                      currentUserId={currentUserId}
                    />
                  </div>
                </SheetScrollArea>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

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
