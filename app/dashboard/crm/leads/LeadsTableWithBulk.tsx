"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAlert } from "@/hooks/use-alert";
import { useFilter } from "@/hooks/use-filter";
import { FilterDialog, type FilterField } from "@/components/ui/filter-dialog";
import { LeadStatusSelect } from "./LeadStatusSelect";
import { LeadSalesPersonSelect } from "./LeadSalesPersonSelect";
import { LeadSourceSelect } from "./LeadSourceSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/hooks/use-confirm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Pencil,
  MessageSquarePlus,
  MoreHorizontal,
  Trash2,
  ChevronDown,
  ChevronUp,
  UserRound,
  Briefcase,
  Building2,
  Check,
  Filter,
  X,
  FileText,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FollowUpTimeline } from "../components/FollowUpTimeline";
import { WriteFollowUpDialog } from "../components/WriteFollowUpDialog";
import { createManualFollowUpAction, updateLeadAction, softDeleteLeadAction, syncLeadNameToCustomerAction, syncLeadContactPhoneToCustomerAction, syncLeadContactPhoneToOpportunityAction } from "@/app/lib/crm-actions";
import { LEAD_STATUS } from "@/app/lib/crm-constants";

type Lead = {
  id: string;
  customerName: string;
  nickname: string | null;
  address?: string | null;
  city: string | null;
  industry: string | null;
  leadSource: string | null;
  contactPhone: string | null;
  createdAt: Date;
  customerTier?: string | null;
  status: string;
  salesPersonId: string | null;
  salesPerson: { id: string; name: string } | null;
  isClaimed?: boolean;
  opportunity: {
    id: string;
    name: string;
    customer?: { id: string; status?: string } | null;
  } | null;
};

type User = { id: string; name: string };

export function LeadsTableWithBulk({
  leads,
  users,
  isAdmin,
  currentUserRole,
  currentUserId,
  highlightId,
}: {
  leads: Lead[];
  users: User[];
  isAdmin: boolean;
  currentUserRole?: string;
  currentUserId?: string;
  highlightId?: string;
}) {
  const router = useRouter();
  const { showAlert, AlertComponent } = useAlert();
  const { showConfirm, ConfirmComponent } = useConfirm();
  const [expandedLeadIds, setExpandedLeadIds] = useState<Set<string>>(new Set());
  const [writeFollowUpLeadId, setWriteFollowUpLeadId] = useState<string | null>(null);
  const [followUpRefreshKeys, setFollowUpRefreshKeys] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editing, setEditing] = useState<{ leadId: string; field: string; value: string } | null>(null);
  // 细粒度保存状态：Set<"leadId:field">
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState(leads);
  const [filterOpen, setFilterOpen] = useState(false);
  /** 线索客户名称/联系方式保存成功后，弹框询问是否同步到客户表/商机表 */
  const [syncToCustomerDialog, setSyncToCustomerDialog] = useState<{
    syncField: "customerName" | "contactPhone";
    newValue: string;
    customerId?: string;
    opportunityId?: string;
    /** 联系方式同步时：勾选同步到商机表（仅 contactPhone 时有效） */
    syncToOpportunity?: boolean;
    /** 联系方式同步时：勾选同步到客户表（仅 contactPhone 时有效） */
    syncToCustomer?: boolean;
  } | null>(null);
  const [isSyncingToCustomer, setIsSyncingToCustomer] = useState(false);
  /** 查看记录：打开详情滑层的线索 id */
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);

  // 定义筛选字段
  const filterFields: FilterField[] = [
    { key: "customerName", label: "客户名称", type: "text" },
    { key: "nickname", label: "昵称", type: "text" },
    { key: "city", label: "城市", type: "text" },
    { key: "industry", label: "行业", type: "text" },
    { key: "leadSource", label: "线索来源", type: "text" },
    { key: "contactPhone", label: "联系方式", type: "text" },
    { key: "status", label: "状态", type: "select", options: LEAD_STATUS.map(s => ({ value: s, label: s })) },
    { key: "salesPerson.name", label: "销售人员", type: "text" },
    { key: "createdAt", label: "创建时间", type: "date" },
  ];

  // 使用筛选 Hook
  const { filteredData, conditions, applyFilter, clearFilter, hasActiveFilters } = useFilter(rows, filterFields);

  // 更新 rows 时同步更新筛选结果
  useEffect(() => {
    setRows(leads);
  }, [leads]);

  useEffect(() => {
    if (highlightId) {
      setExpandedLeadIds((prev) => new Set(prev).add(highlightId));
      setTimeout(() => {
        const row = document.getElementById(`lead-row-${highlightId}`);
        if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [highlightId]);

  const toggleExpandedLead = (id: string) => {
    setExpandedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    setRows(leads);
  }, [leads]);

  const handleWriteFollowUp = async (data: {
    content: string;
    contactPerson?: string;
    summary?: string;
    nextStep?: string;
    customerNeeds?: string;
  }) => {
    if (!writeFollowUpLeadId) return;

    setIsSubmitting(true);
    try {
      const result = await createManualFollowUpAction({
        leadId: writeFollowUpLeadId,
        ...data,
      });
      if (result?.error) {
        showAlert(result.error, { type: "error", title: "操作失败" });
      } else {
        const leadIdJustSubmitted = writeFollowUpLeadId;
        setWriteFollowUpLeadId(null);
        setFollowUpRefreshKeys((prev) => ({
          ...prev,
          [leadIdJustSubmitted]: (prev[leadIdJustSubmitted] ?? 0) + 1,
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

  const currentWriteFollowUpLead = rows.find((l) => l.id === writeFollowUpLeadId);

  const startEdit = (leadId: string, field: string, currentValue: string | null) => {
    setEditing({ leadId, field, value: currentValue ?? "" });
  };

  const cancelEdit = () => setEditing(null);

  /** 从下拉框选择线索来源后直接保存（与状态/销售人员同样的不撑开表格的下拉） */
  const saveLeadSourceOption = async (leadId: string, newSource: string) => {
    const lead = rows.find((l) => l.id === leadId);
    if (!lead || lead.leadSource === newSource) return;
    const fieldKey = `${leadId}:leadSource`;
    if (savingFields.has(fieldKey)) return;

    const prevRow = { ...lead };
    setRows((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, leadSource: newSource } : l))
    );
    setSavingFields((prev) => new Set(prev).add(fieldKey));

    try {
      const formData = new FormData();
      formData.append("leadId", leadId);
      formData.append("customerName", lead.customerName);
      formData.append("nickname", lead.nickname ?? "");
      formData.append("address", lead.address ?? "");
      formData.append("city", lead.city ?? "");
      formData.append("industry", lead.industry ?? "");
      formData.append("leadSource", newSource);
      formData.append("contactPhone", lead.contactPhone ?? "");
      formData.append("customerTier", lead.customerTier ?? "");
      formData.append("salesPersonId", lead.salesPersonId ?? "");
      formData.append("status", lead.status);
      formData.append("inline", "1");
      const result = await updateLeadAction(null, formData);
      if (result?.error) {
        setRows((prev) =>
          prev.map((l) => (l.id === leadId ? prevRow : l))
        );
        showAlert(result.error, { type: "error", title: "操作失败" });
      } else {
        router.refresh();
      }
    } catch (e) {
      setRows((prev) =>
        prev.map((l) => (l.id === leadId ? prevRow : l))
      );
      showAlert("保存失败", { type: "error", title: "操作失败" });
    } finally {
      setSavingFields((prev) => {
        const next = new Set(prev);
        next.delete(fieldKey);
        return next;
      });
    }
  };

  const getLeadFieldValue = (lead: Lead, field: string): string => {
    switch (field) {
      case "customerName": return lead.customerName;
      case "nickname": return lead.nickname ?? "";
      case "address": return lead.address ?? "";
      case "city": return lead.city ?? "";
      case "industry": return lead.industry ?? "";
      case "leadSource": return lead.leadSource ?? "";
      case "contactPhone": return lead.contactPhone ?? "";
      case "customerTier": return lead.customerTier ?? "";
      default: return "";
    }
  };

  const saveLeadEdit = async () => {
    if (!editing) return;
    const lead = rows.find((l) => l.id === editing.leadId);
    if (!lead) return;
    const current = getLeadFieldValue(lead, editing.field);
    if (editing.value === current) {
      setEditing(null);
      return;
    }

    const fieldKey = `${editing.leadId}:${editing.field}`;

    // 如果该字段正在保存，直接返回（避免重复保存）
    if (savingFields.has(fieldKey)) return;

    const prevRow = lead;
    const editingField = editing.field;
    const editingLeadId = editing.leadId;
    const editingValue = editing.value;

    // 乐观更新：立即更新UI
    const nextValue =
      editing.field === "customerName" && !editing.value.trim()
        ? "（待补全）"
        : editing.value;
    setRows((prev) =>
      prev.map((l) => (l.id === editing.leadId ? { ...l, [editing.field]: nextValue } : l))
    );

    // 标记为保存中
    setSavingFields((prev) => new Set(prev).add(fieldKey));

    // 关闭编辑框，允许用户继续编辑其他字段
    setEditing(null);

    // 异步保存（完全异步，不阻塞）
    try {
      const formData = new FormData();
      formData.append("leadId", editingLeadId);
      formData.append("customerName", lead.customerName);
      formData.append("nickname", lead.nickname ?? "");
      formData.append("address", lead.address ?? "");
      formData.append("city", lead.city ?? "");
      formData.append("industry", lead.industry ?? "");
      formData.append("leadSource", lead.leadSource ?? "");
      formData.append("contactPhone", lead.contactPhone ?? "");
      formData.append("customerTier", lead.customerTier ?? "");
      formData.append("salesPersonId", lead.salesPersonId ?? "");
      formData.append("status", lead.status);
      formData.append("inline", "1");
      formData.set(editingField, editingValue);

      const result = await updateLeadAction(null, formData);

      if (result?.error) {
        // 保存失败，回滚UI
        setRows((prev) =>
          prev.map((l) => (l.id === prevRow.id ? prevRow : l))
        );
        showAlert(result.error, { type: "error", title: "操作失败" });
      } else {
        // 保存成功：客户名称仅同步客户表；联系方式可同步客户表+商机表
        if (editingField === "customerName" && prevRow.opportunity?.customer?.id) {
          setSyncToCustomerDialog({
            syncField: "customerName",
            newValue: editingValue.trim() || "（待补全）",
            customerId: prevRow.opportunity.customer.id,
          });
          return;
        }
        if (editingField === "contactPhone" && prevRow.opportunity?.id) {
          const hasCustomer = !!prevRow.opportunity.customer?.id;
          setSyncToCustomerDialog({
            syncField: "contactPhone",
            newValue: editingValue.trim(),
            customerId: prevRow.opportunity.customer?.id,
            opportunityId: prevRow.opportunity.id,
            syncToOpportunity: true,
            syncToCustomer: hasCustomer,
          });
          return;
        }
        router.refresh();
      }
    } catch (e) {
      console.error(e);
      // 保存失败，回滚UI
      setRows((prev) =>
        prev.map((l) => (l.id === prevRow.id ? prevRow : l))
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

  const canEditLead = (lead: Lead) =>
    isAdmin || (currentUserId != null && lead.salesPersonId === currentUserId);

  const renderLeadCell = (
    lead: Lead,
    field: string,
    displayValue: string,
    options?: { align?: "left" | "center" }
  ) => {
    if (!canEditLead(lead)) return <span className="text-left">{displayValue || "-"}</span>;
    const isEditing = editing?.leadId === lead.id && editing?.field === field;

    // 线索来源：与“销售人员”“状态”同款下拉，不撑开表格；选“自定义...”时切换为像客户名称那样的输入框
    if (field === "leadSource") {
      if (isEditing) {
        return (
          <Input
            autoFocus
            value={editing.value}
            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
            onBlur={saveLeadEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveLeadEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            className="h-8 border-primary"
            disabled={savingFields.has(`${lead.id}:${field}`)}
            placeholder="输入后回车确定"
          />
        );
      }
      return (
        <LeadSourceSelect
          value={lead.leadSource ?? ""}
          onSelect={(value) => saveLeadSourceOption(lead.id, value)}
          onRequestCustomInput={() =>
            startEdit(lead.id, "leadSource", getLeadFieldValue(lead, "leadSource"))
          }
          disabled={savingFields.has(`${lead.id}:leadSource`)}
        />
      );
    }

    if (isEditing) {
      const commonInputProps = {
        autoFocus: true,
        value: editing.value,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          setEditing({ ...editing, value: e.target.value }),
        onBlur: saveLeadEdit,
        onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") saveLeadEdit();
          if (e.key === "Escape") cancelEdit();
        },
        className: "h-8 border-primary text-left",
        disabled: savingFields.has(`${lead.id}:${field}`),
      };
      return <Input {...commonInputProps} />;
    }
    const fieldKey = `${lead.id}:${field}`;
    const isSaving = savingFields.has(fieldKey);
    const centerDisplayFields = ["customerName", "nickname", "address", "city", "industry", "contactPhone", "customerTier"];
    const alignLeft = options?.align === "left";

    return (
      <div
        onClick={() => {
          if (!isSaving) {
            startEdit(lead.id, field, getLeadFieldValue(lead, field));
          }
        }}
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1 text-left",
          centerDisplayFields.includes(field) && !alignLeft && "w-full justify-center",
          alignLeft && "w-full justify-start",
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

  /** 流转阶段：1=线索 2=商机 3=客户 */
  const getFlowStage = (lead: Lead): 1 | 2 | 3 => {
    if (!lead.opportunity) return 1;
    if (lead.opportunity.customer) return 3;
    return 2;
  };

  const LeadFlowBar = ({ lead }: { lead: Lead }) => {
    const stage = getFlowStage(lead);
    const customerStatus = lead.opportunity?.customer?.status;
    const isCustomerSigned = customerStatus === "已签约";
    const steps: { key: 1 | 2 | 3; label: string; Icon: typeof UserRound }[] = [
      { key: 1, label: "线索", Icon: UserRound },
      { key: 2, label: "商机", Icon: Briefcase },
      { key: 3, label: "客户", Icon: Building2 },
    ];
    return (
      <div className="flex items-center justify-center gap-1">
        {steps.map(({ key, label, Icon }, i) => {
          const isDone = stage > key || (key === 3 && stage === 3 && isCustomerSigned);
          const isCurrent = stage === key && !(key === 3 && isCustomerSigned);
          const isPending = stage < key;
          return (
            <span key={key} className="flex items-center gap-1">
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs whitespace-nowrap
                  ${isDone ? "text-green-600 bg-green-50" : ""}
                  ${isCurrent ? "text-primary font-semibold bg-primary/10 ring-1 ring-primary/30" : ""}
                  ${isPending ? "text-muted-foreground/60" : ""}`}
                title={isCurrent ? `当前在「${label}」` : isDone ? `已完成「${label}」` : `未到「${label}」`}
              >
                {isDone ? <Check className="h-3 w-3 shrink-0" /> : <Icon className="h-3 w-3 shrink-0" />}
                <span>{label}</span>
              </span>
              {i < steps.length - 1 && (
                <span className="text-muted-foreground/40 text-[10px]">→</span>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <AlertComponent />
      <ConfirmComponent />
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

      <div className="space-y-3">
        <div className="rounded-lg border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="w-10 px-4 py-3 text-center font-medium"></th>
                <th className="px-4 py-3 text-center font-medium">客户名称</th>
                <th className="px-4 py-3 text-center font-medium">昵称</th>
                <th className="px-4 py-3 text-center font-medium">城市</th>
                <th className="px-4 py-3 text-center font-medium">行业</th>
                <th className="px-4 py-3 text-center font-medium">线索来源</th>
                <th className="px-4 py-3 text-center font-medium">联系方式</th>
                <th className="px-4 py-3 text-center font-medium">创建日期</th>
                <th className="px-4 py-3 text-center font-medium">销售人员</th>
                <th className="px-4 py-3 text-center font-medium">状态</th>
                <th className="px-4 py-3 text-center font-medium" title="线索→商机→客户，高亮为当前阶段">
                  流转阶段
                </th>
                <th className="px-4 py-3 text-center font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="[&_td]:text-center">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    暂无数据，仅管理员可点击「新建线索」添加一条空记录后在表格内编辑
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
                filteredData.map((lead) => (
                  <Fragment key={lead.id}>
                    <tr
                      id={`lead-row-${lead.id}`}
                      className={`border-b last:border-0 hover:bg-muted/30 ${highlightId === lead.id ? "animate-highlight-row" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleExpandedLead(lead.id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {expandedLeadIds.has(lead.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">{renderLeadCell(lead, "customerName", lead.customerName)}</td>
                      <td className="px-4 py-3">{renderLeadCell(lead, "nickname", lead.nickname ?? "-")}</td>
                      <td className="px-4 py-3">{renderLeadCell(lead, "city", lead.city ?? "-")}</td>
                      <td className="px-4 py-3">{renderLeadCell(lead, "industry", lead.industry ?? "-")}</td>
                      <td className="px-4 py-3">{renderLeadCell(lead, "leadSource", lead.leadSource ?? "-")}</td>
                      <td className="px-4 py-3">{renderLeadCell(lead, "contactPhone", lead.contactPhone ?? "-")}</td>
                      <td className="px-4 py-3">
                        {lead.createdAt.toLocaleDateString("zh-CN")}
                      </td>
                      <td className="px-4 py-3">
                        <LeadSalesPersonSelect
                          leadId={lead.id}
                          currentSalesPersonId={lead.salesPersonId}
                          users={users}
                          canAssign={isAdmin}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <LeadStatusSelect
                          leadId={lead.id}
                          currentStatus={lead.status}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <LeadFlowBar lead={lead} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1"
                            onClick={() => setWriteFollowUpLeadId(lead.id)}
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
                              <DropdownMenuItem onClick={() => setDetailLeadId(lead.id)}>
                                <FileText className="mr-2 h-4 w-4" />
                                查看记录
                              </DropdownMenuItem>
                              {lead.opportunity && canEditLead(lead) && (
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/dashboard/crm/opportunities?highlight=${lead.opportunity.id}`}
                                  >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    编辑/补全商机
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              {isAdmin && (
                                <>
                                  {(!!lead.opportunity && canEditLead(lead)) && <DropdownMenuSeparator />}
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => {
                                      showConfirm(
                                        {
                                          title: "确认删除线索",
                                          description: `确定要删除线索「${lead.customerName}」吗？\n删除后线索将被移至回收站，管理员可以恢复。${lead.opportunity ? "\n注意：该线索关联的商机及客户不会自动删除。" : ""}`,
                                          confirmText: "确认删除",
                                          variant: "destructive",
                                        },
                                        async () => {
                                          const formData = new FormData();
                                          formData.append("leadId", lead.id);
                                          const result =
                                            await softDeleteLeadAction(formData);
                                          if (result?.error) {
                                            showAlert(result.error, {
                                              type: "error",
                                              title: "删除失败",
                                            });
                                          } else {
                                            showAlert(
                                              "线索已删除，可在回收站中恢复",
                                              {
                                                type: "success",
                                                title: "删除成功",
                                              }
                                            );
                                            window.location.reload();
                                          }
                                        }
                                      );
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    删除
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                    {expandedLeadIds.has(lead.id) && (
                      <tr>
                        <td colSpan={12} className="bg-gray-50 px-4 py-4 !text-left">
                          <div className="rounded-lg border border-gray-200 bg-white p-4 text-left">
                            <h4 className="mb-3 font-semibold text-gray-900 text-left">
                              跟进时间线
                            </h4>
                            <FollowUpTimeline
                              leadId={lead.id}
                              currentUserRole={currentUserRole}
                              refreshKey={followUpRefreshKeys[lead.id] ?? 0}
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
        {currentWriteFollowUpLead && (
          <WriteFollowUpDialog
            isOpen={!!writeFollowUpLeadId}
            onClose={() => setWriteFollowUpLeadId(null)}
            onConfirm={handleWriteFollowUp}
            recordType="线索"
            recordName={currentWriteFollowUpLead.customerName}
            isSubmitting={isSubmitting}
          />
        )}

        {/* 查看记录：右侧滑层展示完整字段并支持行内编辑 */}
        <Sheet open={!!detailLeadId} onOpenChange={(open) => !open && setDetailLeadId(null)}>
          <SheetContent side="right" className="flex flex-col overflow-hidden">
            {(() => {
              const lead = detailLeadId ? rows.find((l) => l.id === detailLeadId) : null;
              if (!lead) return null;
              const detailRows: { key: string; label: string; editable: boolean }[] = [
                { key: "customerName", label: "客户名称", editable: true },
                { key: "nickname", label: "昵称", editable: true },
                { key: "address", label: "地址", editable: true },
                { key: "city", label: "城市", editable: true },
                { key: "industry", label: "行业", editable: true },
                { key: "leadSource", label: "线索来源", editable: true },
                { key: "contactPhone", label: "联系方式", editable: true },
                { key: "customerTier", label: "客户等级", editable: true },
                { key: "createdAt", label: "创建时间", editable: false },
                { key: "salesPersonId", label: "销售人员", editable: true },
                { key: "status", label: "状态", editable: true },
              ];
              return (
                <>
                  <SheetHeader className="shrink-0 border-b pb-3 text-left">
                    <SheetTitle>线索详情 · {lead.customerName}</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 flex-1 overflow-y-auto space-y-4 text-left">
                    {detailRows.map(({ key, label, editable }) => (
                      <div key={key} className="space-y-1.5 text-left">
                        <div className="text-xs font-medium text-muted-foreground">{label}</div>
                        {/* 输入框最大宽度：改此处的 max-w-sm 即可，如 max-w-md / max-w-lg */}
                        <div className="min-h-[32px] flex items-center text-sm justify-start text-left w-full max-w-sm pl-1">
                          {key === "createdAt" && (
                            <span className="text-muted-foreground">
                              {lead.createdAt.toLocaleString("zh-CN")}
                            </span>
                          )}
                          {key === "salesPersonId" && (
                            <LeadSalesPersonSelect
                              leadId={lead.id}
                              currentSalesPersonId={lead.salesPersonId}
                              users={users}
                              canAssign={isAdmin}
                            />
                          )}
                          {key === "status" && (
                            <LeadStatusSelect leadId={lead.id} currentStatus={lead.status} />
                          )}
                          {editable && key !== "createdAt" && key !== "salesPersonId" && key !== "status" && (
                            renderLeadCell(lead, key, getLeadFieldValue(lead, key) || "-", { align: "left" })
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </SheetContent>
        </Sheet>

        {/* 客户名称/联系方式同步确认框 */}
        <Dialog
          open={!!syncToCustomerDialog}
          onOpenChange={(open) => {
            if (!open) {
              setSyncToCustomerDialog(null);
              router.refresh();
            }
          }}
        >
          <DialogContent className="sm:max-w-md" overlayClassName="bg-black/40">
            <DialogHeader>
              <DialogTitle>
                {syncToCustomerDialog?.syncField === "customerName"
                  ? "同步到客户表？"
                  : "同步联系方式到"}
              </DialogTitle>
              <DialogDescription>
                {syncToCustomerDialog?.syncField === "customerName" && (
                  <>该线索已转为客户。是否将客户表中的客户名称也改为「{syncToCustomerDialog.newValue}」？</>
                )}
                {syncToCustomerDialog?.syncField === "contactPhone" && (
                  <>
                    将联系方式「{syncToCustomerDialog.newValue || "（空）"}」同步到已选表，可勾选需要同步的目标：
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            {syncToCustomerDialog?.syncField === "contactPhone" && (
              <div className="flex flex-col gap-2 py-2">
                {syncToCustomerDialog.opportunityId && (
                  <button
                    type="button"
                    onClick={() =>
                      setSyncToCustomerDialog((prev) =>
                        prev?.syncToOpportunity === undefined
                          ? prev
                          : { ...prev, syncToOpportunity: !prev.syncToOpportunity }
                      )
                    }
                    className={cn(
                      "flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                      syncToCustomerDialog.syncToOpportunity
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-muted bg-muted/30 text-muted-foreground hover:border-muted-foreground/50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                        syncToCustomerDialog.syncToOpportunity
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {syncToCustomerDialog.syncToOpportunity ? (
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                      ) : null}
                    </span>
                    <Briefcase className="h-5 w-5 shrink-0" />
                    <span className="font-medium">商机表</span>
                  </button>
                )}
                {syncToCustomerDialog.customerId && (
                  <button
                    type="button"
                    onClick={() =>
                      setSyncToCustomerDialog((prev) =>
                        prev?.syncToCustomer === undefined
                          ? prev
                          : { ...prev, syncToCustomer: !prev.syncToCustomer }
                      )
                    }
                    className={cn(
                      "flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                      syncToCustomerDialog.syncToCustomer
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-muted bg-muted/30 text-muted-foreground hover:border-muted-foreground/50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                        syncToCustomerDialog.syncToCustomer
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {syncToCustomerDialog.syncToCustomer ? (
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
                  setSyncToCustomerDialog(null);
                  router.refresh();
                }}
                disabled={isSyncingToCustomer}
              >
                仅更新线索
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  const d = syncToCustomerDialog;
                  if (!d) return;
                  setIsSyncingToCustomer(true);
                  try {
                    if (d.syncField === "customerName" && d.customerId) {
                      const result = await syncLeadNameToCustomerAction(d.customerId, d.newValue);
                      if (result?.error) {
                        showAlert(result.error, { type: "error", title: "同步失败" });
                        return;
                      }
                      showAlert("客户名称已同步到客户表", { type: "success", title: "已同步" });
                    } else if (d.syncField === "contactPhone") {
                      const tasks: Promise<{ error?: string } | null>[] = [];
                      if (d.syncToCustomer && d.customerId)
                        tasks.push(syncLeadContactPhoneToCustomerAction(d.customerId, d.newValue));
                      if (d.syncToOpportunity && d.opportunityId)
                        tasks.push(syncLeadContactPhoneToOpportunityAction(d.opportunityId, d.newValue));
                      if (tasks.length === 0) {
                        setSyncToCustomerDialog(null);
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
                      if (d.syncToCustomer && d.customerId) parts.push("客户表");
                      showAlert(`联系方式已同步到${parts.join("、")}`, { type: "success", title: "已同步" });
                    } else {
                      setSyncToCustomerDialog(null);
                      router.refresh();
                      return;
                    }
                    setSyncToCustomerDialog(null);
                    router.refresh();
                  } catch (e) {
                    console.error(e);
                    showAlert("同步失败，请重试", { type: "error", title: "同步失败" });
                  } finally {
                    setIsSyncingToCustomer(false);
                  }
                }}
                disabled={
                  isSyncingToCustomer ||
                  (syncToCustomerDialog?.syncField === "contactPhone" &&
                    !(syncToCustomerDialog.syncToOpportunity && syncToCustomerDialog.opportunityId) &&
                    !(syncToCustomerDialog.syncToCustomer && syncToCustomerDialog.customerId))
                }
              >
                {isSyncingToCustomer ? "同步中…" : "同步"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
