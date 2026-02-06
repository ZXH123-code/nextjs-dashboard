"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAlert } from "@/hooks/use-alert";
import { useFilter } from "@/hooks/use-filter";
import { FilterDialog, type FilterField } from "@/components/ui/filter-dialog";
import { LeadStatusSelect } from "./LeadStatusSelect";
import { LeadSalesPersonSelect } from "./LeadSalesPersonSelect";
import { DeleteLeadButton } from "./DeleteLeadButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import {
  Pencil,
  MessageSquarePlus,
  ChevronDown,
  ChevronUp,
  UserRound,
  Briefcase,
  Building2,
  Check,
  Filter,
  X,
} from "lucide-react";
import { FollowUpTimeline } from "../components/FollowUpTimeline";
import { WriteFollowUpDialog } from "../components/WriteFollowUpDialog";
import { createManualFollowUpAction, updateLeadAction } from "@/app/lib/crm-actions";
import { LEAD_STATUS } from "@/app/lib/crm-constants";

type Lead = {
  id: string;
  customerName: string;
  nickname: string | null;
  city: string | null;
  industry: string | null;
  leadSource: string | null;
  contactPhone: string | null;
  createdAt: Date;
  status: string;
  salesPersonId: string | null;
  salesPerson: { id: string; name: string } | null;
  opportunity: {
    id: string;
    name: string;
    customer?: { id: string } | null;
  } | null;
};

type User = { id: string; name: string };

export function LeadsTableWithBulk({
  leads,
  users,
  isAdmin,
  currentUserRole,
  highlightId,
}: {
  leads: Lead[];
  users: User[];
  isAdmin: boolean;
  currentUserRole?: string;
  highlightId?: string;
}) {
  const router = useRouter();
  const { showAlert, AlertComponent } = useAlert();
  const [expandedLeadIds, setExpandedLeadIds] = useState<Set<string>>(new Set());
  const [writeFollowUpLeadId, setWriteFollowUpLeadId] = useState<string | null>(null);
  const [followUpRefreshKeys, setFollowUpRefreshKeys] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editing, setEditing] = useState<{ leadId: string; field: string; value: string } | null>(null);
  // 细粒度保存状态：Set<"leadId:field">
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState(leads);
  const [filterOpen, setFilterOpen] = useState(false);

  // 线索来源选项
  const LEAD_SOURCE_OPTIONS: ComboboxOption[] = [
    { value: "线上", label: "线上" },
    { value: "线下", label: "线下" },
    { value: "协会介绍", label: "协会介绍" },
    { value: "政府部门介绍", label: "政府部门介绍" },
    { value: "客户推荐", label: "客户推荐" },
    { value: "电商渠道", label: "电商渠道" },
  ];

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

  const getLeadFieldValue = (lead: Lead, field: string): string => {
    switch (field) {
      case "customerName": return lead.customerName;
      case "nickname": return lead.nickname ?? "";
      case "city": return lead.city ?? "";
      case "industry": return lead.industry ?? "";
      case "leadSource": return lead.leadSource ?? "";
      case "contactPhone": return lead.contactPhone ?? "";
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
      formData.append("city", lead.city ?? "");
      formData.append("industry", lead.industry ?? "");
      formData.append("leadSource", lead.leadSource ?? "");
      formData.append("contactPhone", lead.contactPhone ?? "");
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
        // 保存成功，刷新数据
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

  const renderLeadCell = (lead: Lead, field: string, displayValue: string) => {
    if (!isAdmin) return <>{displayValue || "-"}</>;
    const isEditing = editing?.leadId === lead.id && editing?.field === field;
    if (isEditing) {
      // 线索来源字段使用 Combobox
      if (field === "leadSource") {
        return (
          <Combobox
            value={editing.value}
            options={LEAD_SOURCE_OPTIONS}
            onChange={(value) => setEditing({ ...editing, value })}
            onBlur={saveLeadEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveLeadEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            placeholder="选择或输入线索来源"
            disabled={savingFields.has(`${lead.id}:${field}`)}
            className="h-8 border-primary"
            allowCustom={true}
          />
        );
      }
      
      // 其他字段使用普通 Input
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
        />
      );
    }
    const fieldKey = `${lead.id}:${field}`;
    const isSaving = savingFields.has(fieldKey);
    
    return (
      <div
        onClick={() => {
          if (!isSaving) {
            startEdit(lead.id, field, getLeadFieldValue(lead, field));
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

  /** 流转阶段：1=线索 2=商机 3=客户 */
  const getFlowStage = (lead: Lead): 1 | 2 | 3 => {
    if (!lead.opportunity) return 1;
    if (lead.opportunity.customer) return 3;
    return 2;
  };

  const LeadFlowBar = ({ lead }: { lead: Lead }) => {
    const stage = getFlowStage(lead);
    const steps: { key: 1 | 2 | 3; label: string; Icon: typeof UserRound }[] = [
      { key: 1, label: "线索", Icon: UserRound },
      { key: 2, label: "商机", Icon: Briefcase },
      { key: 3, label: "客户", Icon: Building2 },
    ];
    return (
      <div className="flex items-center justify-center gap-1">
        {steps.map(({ key, label, Icon }, i) => {
          const isDone = stage > key;
          const isCurrent = stage === key;
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
                <th className="w-10 px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium">客户名称</th>
                <th className="px-4 py-3 font-medium">昵称</th>
                <th className="px-4 py-3 font-medium">城市</th>
                <th className="px-4 py-3 font-medium">行业</th>
                <th className="px-4 py-3 font-medium">线索来源</th>
                <th className="px-4 py-3 font-medium">联系方式</th>
                <th className="px-4 py-3 font-medium">创建日期</th>
                <th className="px-4 py-3 font-medium">销售人员</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium text-center" title="线索→商机→客户，高亮为当前阶段">
                  流转阶段
                </th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
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
                      className={`border-b last:border-0 hover:bg-muted/30 ${highlightId === lead.id ? "bg-yellow-50" : ""}`}
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1"
                            onClick={() => setWriteFollowUpLeadId(lead.id)}
                          >
                            <MessageSquarePlus className="h-3.5 w-3.5" />
                            写跟进
                          </Button>
                          {lead.opportunity && (
                            <Button asChild size="sm" variant="default" className="h-7 gap-1">
                              <Link
                                href={`/dashboard/crm/opportunities?highlight=${lead.opportunity.id}`}
                                className="inline-flex items-center gap-1.5"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                编辑/补全商机
                              </Link>
                            </Button>
                          )}
                          {isAdmin && (
                            <DeleteLeadButton
                              leadId={lead.id}
                              leadName={lead.customerName}
                              hasOpportunity={!!lead.opportunity}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedLeadIds.has(lead.id) && (
                      <tr>
                        <td colSpan={11} className="bg-gray-50 px-4 py-4">
                          <div className="rounded-lg border border-gray-200 bg-white p-4">
                            <h4 className="mb-3 font-semibold text-gray-900">
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

        {highlightId && (
          <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            当前高亮：从商机表「查看线索」跳转
          </div>
        )}

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
      </div>
    </>
  );
}
