"use client";

import { useState, useEffect, Fragment, useMemo, useCallback, memo } from "react";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAlert } from "@/hooks/use-alert";
import { FilterDialog, type FilterField, type FilterCondition, type FilterGroup } from "@/components/ui/filter-dialog";
import type { LeadFilter } from "@/app/lib/crm";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  Star,
  CalendarDays,
  ArrowUpDown,
} from "lucide-react";
import { LoadingSpinner } from "@/app/ui/loading-spinner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SheetScrollArea } from "@/components/ui/sheet-scroll-area";
import { FollowUpTimeline } from "../components/FollowUpTimeline";
import { WriteFollowUpDialog } from "../components/WriteFollowUpDialog";
import { createManualFollowUpAction, updateLeadAction, softDeleteLeadAction, syncLeadNameToCustomerAction, syncLeadContactPhoneToCustomerAction, syncLeadContactPhoneToOpportunityAction, batchUpdateLeadSalesPersonWithFollowUpAction, toggleLeadKeyFocusAction, batchSetLeadKeyFocusAction, batchSoftDeleteLeadsAction, getLeadIdsAction, addLeadsToMonthlyPlanAction, addMyLeadsToMonthlyPlanAction } from "@/app/lib/crm-actions";
import { LEAD_STATUS } from "@/app/lib/crm-constants";

type Lead = {
  id: string;
  customerName: string;
  nickname: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  city: string | null;
  industry: string | null;
  leadSource: string | null;
  contactPhone: string | null;
  createdAt: Date;
  customerTier?: string | null;
  status: string;
  assignees: { userId: string; user: { id: string; name: string } }[];
  isClaimed?: boolean;
  isKeyFocus?: boolean;
  keyFocusByAdmin?: boolean;
  remark?: string | null;
  importSource?: string | null;
  extraFields?: Prisma.JsonValue | null;
  opportunity: {
    id: string;
    name: string;
    customer?: { id: string; status?: string } | null;
  } | null;
};

type User = { id: string; name: string };

/** 多选复选框单元格：memo 避免未勾选行在他人勾选时重渲染，减轻卡顿 */
const LeadRowCheckbox = memo(function LeadRowCheckbox({
  leadId,
  checked,
  onToggle,
}: {
  leadId: string;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <td className="px-4 py-3">
      <label className="flex cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(leadId)}
          className="h-4 w-4 rounded border-input"
          onClick={(e) => e.stopPropagation()}
        />
      </label>
    </td>
  );
});

export function LeadsTableWithBulk({
  leads,
  users,
  isAdmin,
  currentUserRole,
  currentUserId,
  highlightId,
  total,
  page,
  pageSize,
  initialFilter,
  filterParam,
  sortBy,
  sortOrder,
}: {
  leads: Lead[];
  users: User[];
  isAdmin: boolean;
  currentUserRole?: string;
  currentUserId?: string;
  highlightId?: string;
  /** 服务端分页：总条数 */
  total?: number;
  /** 服务端分页：当前页 */
  page?: number;
  /** 服务端分页：每页条数 */
  pageSize?: number;
  /** 服务端筛选：来自 URL 的筛选条件 */
  initialFilter?: LeadFilter;
  /** 原始 filter 参数字符串（用于 preserveParams） */
  filterParam?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const doRefresh = () => router.refresh();

  const isServerMode = total != null && page != null && pageSize != null;
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
  /** 批量选择：仅对当前筛选结果（filteredData）多选/全选 */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** 右键菜单位置，有值时显示操作菜单 */
  const [contextMenuAt, setContextMenuAt] = useState<{ x: number; y: number } | null>(null);
  /** 「全选」拉取全部 id 时的加载状态 */
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  /** 当前是否为「全选全部」状态（点击全选全部后为 true，取消或手动改选时置 false） */
  const [hasSelectedAllMatching, setHasSelectedAllMatching] = useState(false);
  /** 批量指定对话框 */
  const [batchAssignOpen, setBatchAssignOpen] = useState(false);
  const [batchAssignSalesPersonId, setBatchAssignSalesPersonId] = useState("");
  /** 用户补充的跟进说明（选填），与自动生成的默认说明分开 */
  const [batchAssignSupplement, setBatchAssignSupplement] = useState("");
  const [batchAssignLoading, setBatchAssignLoading] = useState(false);
  const [batchAssignError, setBatchAssignError] = useState("");
  /** 分配至本月计划对话框 */
  const [monthlyPlanOpen, setMonthlyPlanOpen] = useState(false);
  const [monthlyPlanUserIds, setMonthlyPlanUserIds] = useState<Set<string>>(new Set());
  const [monthlyPlanLoading, setMonthlyPlanLoading] = useState(false);
  const [monthlyPlanError, setMonthlyPlanError] = useState("");

  // 定义筛选字段 - 包含线索表的所有有意义的字段
  const filterFields: FilterField[] = [
    { key: "customerName", label: "客户名称", type: "text" },
    { key: "contactPerson", label: "联系人", type: "text" },
    { key: "nickname", label: "昵称", type: "text" },
    { key: "city", label: "城市", type: "text" },
    { key: "address", label: "地址", type: "text" },
    { key: "industry", label: "行业", type: "text" },
    { key: "leadSource", label: "线索来源", type: "text" },
    { key: "contactPhone", label: "联系方式", type: "text" },
    { key: "customerTier", label: "客户等级", type: "text" },
    { key: "status", label: "状态", type: "select", options: LEAD_STATUS.map((s) => ({ value: s, label: s })) },
    { key: "assignees.name", label: "负责人", type: "text" },
    { key: "isKeyFocus", label: "重点关注", type: "boolean" },
    { key: "keyFocusByAdmin", label: "管理员标注", type: "boolean" },
    { key: "createdAt", label: "创建时间", type: "date" },
  ];

  // 服务端模式：筛选与分页由 URL + 服务端驱动
  const groups = useMemo<FilterGroup[]>(
    () => initialFilter?.groups?.filter((g) => g.conditions?.length) ?? [],
    [initialFilter]
  );
  const hasActiveFilters = groups.length > 0;
  const activeFilterCount = groups.reduce((s, g) => s + g.conditions.length, 0);

  const totalFiltered = isServerMode ? (total ?? 0) : rows.length;
  const totalPages = isServerMode
    ? Math.max(1, Math.ceil((total ?? 0) / (pageSize ?? 20)))
    : 1;
  const currentPage = isServerMode ? (page ?? 1) : 1;
  const currentPageSize = isServerMode ? (pageSize ?? 20) : 20;
  const displayedData = isServerMode ? leads : rows;
  const startItem =
    totalFiltered === 0 ? 0 : (currentPage - 1) * currentPageSize + 1;
  const endItem = Math.min(currentPage * currentPageSize, totalFiltered);

  const buildUrl = (updates: { page?: number; pageSize?: number; filter?: string; sortBy?: string; sortOrder?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.page != null) params.set("page", String(updates.page));
    if (updates.pageSize != null) params.set("pageSize", String(updates.pageSize));
    if (updates.filter !== undefined) {
      if (updates.filter) params.set("filter", updates.filter);
      else params.delete("filter");
    }
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

  const handleApplyFilter = (newConditions: FilterCondition[], newGroups?: FilterGroup[]) => {
    const gs = newGroups?.filter((g) => g.conditions?.length) ?? [];
    const filterStr = gs.length > 0 ? encodeURIComponent(JSON.stringify({ groups: gs })) : "";
    router.replace(buildUrl({ page: 1, filter: filterStr }), { scroll: false });
  };

  const handleClearFilter = () => {
    router.replace(buildUrl({ page: 1, filter: "" }), { scroll: false });
  };

  const handleSortChange = (value: string) => {
    const [by, order] = value.split("-") as [string, string];
    router.replace(buildUrl({ page: 1, sortBy: by, sortOrder: order }), { scroll: false });
  };

  // 当前页/筛选结果的所有 id（全选仅作用于当前页）
  const filteredIds = useMemo(
    () => displayedData.map((l) => l.id),
    [displayedData]
  );
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  const toggleSelectOne = useCallback((id: string) => {
    setHasSelectedAllMatching(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setHasSelectedAllMatching(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredIds.forEach((id) => next.delete(id));
      } else {
        filteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [allFilteredSelected, filteredIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setHasSelectedAllMatching(false);
  }, []);

  /** 全选（共 N 条）：按当前筛选拉取全部 id 并选中 */
  const handleSelectAllMatching = useCallback(async () => {
    if (totalFiltered === 0) return;
    setSelectAllLoading(true);
    try {
      const result = await getLeadIdsAction(filterParam ?? undefined);
      if ("ids" in result && "total" in result) {
        const { ids, total } = result;
        setSelectedIds(new Set(ids));
        setHasSelectedAllMatching(true);
        if (ids.length < total) {
          showAlert(`已选 ${ids.length} 条（共 ${total} 条，全选最多支持 ${ids.length} 条）`, { type: "info", title: "已全选" });
        }
      } else {
        showAlert((result as { error?: string }).error ?? "获取列表失败", { type: "error", title: "全选失败" });
      }
    } finally {
      setSelectAllLoading(false);
    }
  }, [filterParam, totalFiltered, showAlert]);

  /** 取消全部全选：清空当前选择 */
  const handleCancelSelectAllMatching = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // 筛选条件变化时，「全部全选」状态失效
  useEffect(() => {
    setHasSelectedAllMatching(false);
  }, [filterParam]);

  // 选中被清空时（如批量操作后），按钮恢复为「全选全部」
  useEffect(() => {
    if (selectedIds.size === 0) setHasSelectedAllMatching(false);
  }, [selectedIds.size]);

  // 记录区域右键：有选中时显示操作菜单
  const handleTableContextMenu = (e: React.MouseEvent) => {
    if (selectedIds.size === 0) return;
    e.preventDefault();
    setContextMenuAt({ x: e.clientX, y: e.clientY });
  };

  // 关闭右键菜单（点击外部）
  useEffect(() => {
    if (!contextMenuAt) return;
    const close = () => setContextMenuAt(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenuAt]);

  // 批量指定：打开对话框（无权限时友好拦截）
  const openBatchAssignDialog = () => {
    setContextMenuAt(null);
    if (!isAdmin) {
      showAlert("仅管理员可批量指定负责人。", { type: "error", title: "无权限" });
      return;
    }
    setBatchAssignError("");
    setBatchAssignSupplement("");
    setBatchAssignSalesPersonId("");
    setBatchAssignOpen(true);
  };

  // 分配至本月计划：打开对话框
  const openMonthlyPlanDialog = () => {
    setContextMenuAt(null);
    if (!isAdmin) {
      void handleAddToMyMonthlyPlan(Array.from(selectedIds), { clearAfter: true });
      return;
    }
    setMonthlyPlanError("");
    setMonthlyPlanUserIds(new Set());
    setMonthlyPlanOpen(true);
  };

  const handleAddToMyMonthlyPlan = async (
    leadIds: string[],
    options: { clearAfter?: boolean } = {}
  ) => {
    const targetIds = Array.from(new Set((leadIds ?? []).filter(Boolean)));
    if (targetIds.length === 0) {
      showAlert("请先选择至少一条线索", { type: "info", title: "未选择线索" });
      return;
    }

    setMonthlyPlanLoading(true);
    try {
      const result = await addMyLeadsToMonthlyPlanAction(targetIds);
      if ("error" in result) {
        showAlert(result.error, { type: "error", title: "操作失败" });
        return;
      }

      const parts: string[] = [];
      if (result.addedCount > 0) parts.push(`新增 ${result.addedCount} 条`);
      if (result.alreadyCount > 0) parts.push(`已在计划 ${result.alreadyCount} 条`);
      if (result.forbiddenCount > 0) parts.push(`无权限跳过 ${result.forbiddenCount} 条`);

      showAlert(parts.join("，"), {
        type: result.addedCount > 0 ? "success" : "info",
        title: result.addedCount > 0 ? "已纳入本月计划" : "未新增",
      });
      if (options.clearAfter) clearSelection();
      doRefresh();
    } finally {
      setMonthlyPlanLoading(false);
    }
  };

  const handleMonthlyPlanSubmit = async () => {
    if (monthlyPlanUserIds.size === 0) {
      setMonthlyPlanError("请至少选择一位跟进人");
      return;
    }
    setMonthlyPlanError("");
    setMonthlyPlanLoading(true);
    try {
      const result = await addLeadsToMonthlyPlanAction(
        Array.from(selectedIds),
        Array.from(monthlyPlanUserIds)
      );
      if (result && "error" in result && result.error) {
        setMonthlyPlanError(result.error);
      } else {
        setMonthlyPlanOpen(false);
        clearSelection();
        doRefresh();
        showAlert(`已将 ${(result as { count: number }).count} 条线索加入本月计划`, {
          type: "success",
          title: "已分配",
        });
      }
    } finally {
      setMonthlyPlanLoading(false);
    }
  };

  // 批量指定：提交（跟进说明 = 自动生成的默认说明 + 用户补充）
  const handleBatchAssignSubmit = async () => {
    if (!batchAssignSalesPersonId) {
      setBatchAssignError("请选择销售人员");
      return;
    }
    const selectedPerson = users.find((u) => u.id === batchAssignSalesPersonId);
    const defaultLine = selectedPerson
      ? `批量线索已分配给 ${selectedPerson.name}`
      : "";
    const followUpContent = batchAssignSupplement.trim()
      ? `${defaultLine}\n${batchAssignSupplement.trim()}`
      : defaultLine;

    setBatchAssignError("");
    setBatchAssignLoading(true);
    try {
      const result = await batchUpdateLeadSalesPersonWithFollowUpAction(
        Array.from(selectedIds),
        batchAssignSalesPersonId,
        followUpContent
      );
      if (result?.error) {
        setBatchAssignError(result.error);
      } else {
        setBatchAssignOpen(false);
        clearSelection();
        doRefresh();
        const updated = result?.updatedCount ?? 0;
        const skipped = result?.skippedCount ?? 0;
        if (updated === 0) {
          showAlert("所选线索均已由该负责人负责，未做变更。", { type: "success", title: "无需更新" });
        } else {
          const msg = skipped > 0
            ? `已为 ${updated} 条指定负责人，${skipped} 条已是该负责人已跳过。`
            : `已为 ${updated} 条指定负责人。`;
          showAlert(
            result?.salesPersonMap && Object.keys(result.salesPersonMap).length > 0
              ? `${msg} 可发送邮件通知相关人员。`
              : msg,
            { type: "success", title: "已指定" }
          );
        }
      }
    } finally {
      setBatchAssignLoading(false);
    }
  };

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
    if (!writeFollowUpLeadId) return;

    setIsSubmitting(true);
    try {
      const result = await createManualFollowUpAction({
        leadId: writeFollowUpLeadId,
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
      const leadIdJustSubmitted = writeFollowUpLeadId;
      setWriteFollowUpLeadId(null);
      setFollowUpRefreshKeys((prev) => ({
        ...prev,
        [leadIdJustSubmitted]: (prev[leadIdJustSubmitted] ?? 0) + 1,
      }));
      doRefresh();
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
      formData.append("status", lead.status);
      formData.append("inline", "1");
      const result = await updateLeadAction(null, formData);
      if (result?.error) {
        setRows((prev) =>
          prev.map((l) => (l.id === leadId ? prevRow : l))
        );
        showAlert(result.error, { type: "error", title: "操作失败" });
      } else {
        doRefresh();
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
      case "contactPerson": return lead.contactPerson ?? "";
      case "nickname": return lead.nickname ?? "";
      case "address": return lead.address ?? "";
      case "city": return lead.city ?? "";
      case "industry": return lead.industry ?? "";
      case "leadSource": return lead.leadSource ?? "";
      case "contactPhone": return lead.contactPhone ?? "";
      case "customerTier": return lead.customerTier ?? "";
      case "contactEmail": return lead.contactEmail ?? "";
      case "remark": return lead.remark ?? "";
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
        doRefresh();
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

  const leadAssigneeIds = (lead: Lead) => lead.assignees?.map((a) => a.userId) ?? [];
  const canEditLead = (lead: Lead) =>
    isAdmin || (currentUserId != null && leadAssigneeIds(lead).includes(currentUserId));

  const getFieldTextMaxWidthClass = (field: string) => {
    switch (field) {
      case "customerName":
        return "max-w-[135px]";
      case "contactPerson":
        return "max-w-[110px]";
      case "city":
        return "max-w-[90px]";
      case "industry":
        return "max-w-[110px]";
      case "leadSource":
        return "max-w-[130px]";
      case "contactPhone":
        return "max-w-[130px]";
      case "nickname":
        return "max-w-[110px]";
      case "address":
        return "max-w-[180px]";
      case "customerTier":
        return "max-w-[90px]";
      case "contactEmail":
        return "max-w-[170px]";
      case "remark":
        return "max-w-[220px]";
      default:
        return "max-w-[140px]";
    }
  };

  const renderLeadCell = (
    lead: Lead,
    field: string,
    displayValue: string,
    options?: { align?: "left" | "center"; title?: string }
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
        className: cn("h-8 border-primary", (field === "contactPerson" || field === "city" || field === "industry" || field === "contactPhone") ? "text-center" : "text-left"),
        disabled: savingFields.has(`${lead.id}:${field}`),
      };
      return <Input {...commonInputProps} />;
    }
    const fieldKey = `${lead.id}:${field}`;
    const isSaving = savingFields.has(fieldKey);
    const centerDisplayFields = ["customerName", "contactPerson", "address", "city", "industry", "contactPhone", "customerTier"];
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
        title={isSaving ? "保存中..." : (options?.title ?? "点击编辑")}
      >
        {displayValue ? (
          <span
            className={cn(
              "inline-block w-full min-w-0 truncate whitespace-nowrap align-middle",
              getFieldTextMaxWidthClass(field),
              (field === "contactPerson" || field === "city" || field === "industry" || field === "contactPhone") && "text-center"
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

  /** 流转阶段：1=线索 2=商机 3=客户；仅展示当前阶段一个标签 */
  const getFlowStage = (lead: Lead): 1 | 2 | 3 => {
    if (!lead.opportunity) return 1;
    if (lead.opportunity.customer) return 3;
    return 2;
  };

  const LeadFlowBar = ({ lead }: { lead: Lead }) => {
    const stage = getFlowStage(lead);
    const hasAssignee = (lead.assignees?.length ?? 0) > 0;
    const config: { label: string; Icon: typeof UserRound; title: string; className: string } =
      stage === 1
        ? {
          label: "线索",
          Icon: UserRound,
          title: hasAssignee ? "已指派，正在跟进" : "待分配负责人",
          className: hasAssignee
            ? "text-green-700 bg-green-50 ring-1 ring-green-200/60"
            : "text-muted-foreground bg-muted/50",
        }
        : stage === 2
          ? {
            label: "商机",
            Icon: Briefcase,
            title: "已转为商机",
            className: "text-primary font-medium bg-primary/10 ring-1 ring-primary/20",
          }
          : {
            label: "客户",
            Icon: Building2,
            title: "已转为客户",
            className: "text-green-700 bg-green-50 ring-1 ring-green-200/60",
          };
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs whitespace-nowrap ${config.className}`}
        title={config.title}
      >
        <config.Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{config.label}</span>
      </span>
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
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilter}
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
                <SelectItem value="customerName-asc">客户名称 A→Z</SelectItem>
                <SelectItem value="customerName-desc">客户名称 Z→A</SelectItem>
                <SelectItem value="contactPerson-asc">联系人 A→Z</SelectItem>
                <SelectItem value="contactPerson-desc">联系人 Z→A</SelectItem>
                <SelectItem value="createdAt-asc">创建时间 旧→新</SelectItem>
                <SelectItem value="city-asc">城市 A→Z</SelectItem>
                <SelectItem value="city-desc">城市 Z→A</SelectItem>
                <SelectItem value="industry-asc">行业 A→Z</SelectItem>
                <SelectItem value="industry-desc">行业 Z→A</SelectItem>
                <SelectItem value="status-asc">状态 A→Z</SelectItem>
                <SelectItem value="status-desc">状态 Z→A</SelectItem>
                <SelectItem value="leadSource-asc">线索来源 A→Z</SelectItem>
                <SelectItem value="leadSource-desc">线索来源 Z→A</SelectItem>
              </SelectContent>
            </Select>
          )}
          {displayedData.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                className="flex items-center gap-2"
              >
                {allFilteredSelected ? (
                  <>
                    <X className="h-4 w-4" />
                    取消当页全选
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    当页全选（{displayedData.length} 条）
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={hasSelectedAllMatching ? handleCancelSelectAllMatching : handleSelectAllMatching}
                disabled={!hasSelectedAllMatching && (totalFiltered === 0 || selectAllLoading)}
                className="flex items-center gap-2"
              >
                {selectAllLoading ? (
                  <LoadingSpinner type="arc" size={16} className="shrink-0" />
                ) : hasSelectedAllMatching ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {hasSelectedAllMatching ? "取消全部全选" : `全选全部（${totalFiltered} 条）`}
              </Button>
            </>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {totalFiltered === 0
            ? "共 0 条"
            : `共 ${totalFiltered} 条，当前第 ${startItem}–${endItem} 条`}
        </div>
      </div>

      <FilterDialog
        key={filterParam ?? "empty"}
        open={filterOpen}
        onOpenChange={setFilterOpen}
        fields={filterFields}
        conditions={[]}
        groups={groups}
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
      />

      <div className="space-y-3" onContextMenu={handleTableContextMenu}>
        {contextMenuAt && (
          <div
            className="fixed z-50 min-w-[140px] rounded-md border bg-popover py-1 shadow-md"
            style={{ left: contextMenuAt.x, top: contextMenuAt.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={openBatchAssignDialog}
            >
              <UserRound className="h-4 w-4" />
              批量指定
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={openMonthlyPlanDialog}
            >
              <CalendarDays className="h-4 w-4" />
              {isAdmin ? "分配至本月计划" : "纳入我的本月计划"}
            </button>
            <>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={async () => {
                  setContextMenuAt(null);
                  const result = await batchSetLeadKeyFocusAction(Array.from(selectedIds), true);
                  if (result && "error" in result) {
                    showAlert(result.error ?? "操作失败", { type: "error", title: "操作失败" });
                    return;
                  }
                  if (result && "success" in result) {
                    setRows((prev) =>
                      prev.map((r) =>
                        selectedIds.has(r.id)
                          ? { ...r, isKeyFocus: true, keyFocusByAdmin: isAdmin ? true : r.keyFocusByAdmin }
                          : r
                      )
                    );
                    showAlert(`已将为 ${result.count} 条线索标记为重点关注`, { type: "success", title: "已更新" });
                    setSelectedIds(new Set());
                  }
                }}
              >
                <Star className="h-4 w-4" />
                批量标记为重点关注
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={async () => {
                  setContextMenuAt(null);
                  const result = await batchSetLeadKeyFocusAction(Array.from(selectedIds), false);
                  if (result && "error" in result) {
                    showAlert(result.error ?? "操作失败", { type: "error", title: "操作失败" });
                    return;
                  }
                  if (result && "success" in result) {
                    setRows((prev) =>
                      prev.map((r) =>
                        selectedIds.has(r.id)
                          ? { ...r, isKeyFocus: false, keyFocusByAdmin: isAdmin ? false : r.keyFocusByAdmin }
                          : r
                      )
                    );
                    showAlert(`已取消 ${result.count} 条线索的重点关注`, { type: "success", title: "已更新" });
                    setSelectedIds(new Set());
                  }
                }}
              >
                <Star className={cn("h-4 w-4", isAdmin ? "fill-blue-500 text-blue-500" : "fill-amber-400 text-amber-500")} />
                批量取消重点关注
              </button>
            </>
            {isAdmin && (
              <>
                <div className="my-1 border-t border-border" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-accent hover:text-destructive focus:text-destructive"
                  onClick={() => {
                    setContextMenuAt(null);
                    const count = selectedIds.size;
                    showConfirm(
                      {
                        title: "确认批量删除",
                        description: `确定要将选中的 ${count} 条线索移至回收站吗？删除后可在回收站中恢复。若线索已关联商机/客户，不会自动删除。`,
                        confirmText: "确认删除",
                        variant: "destructive",
                      },
                      async () => {
                        const result = await batchSoftDeleteLeadsAction(Array.from(selectedIds));
                        if (result && "error" in result) {
                          showAlert(result.error ?? "删除失败", { type: "error", title: "操作失败" });
                          return;
                        }
                        if (result && "success" in result) {
                          setRows((prev) => prev.filter((r) => !selectedIds.has(r.id)));
                          setSelectedIds(new Set());
                          showAlert(`已将 ${result.count} 条线索移至回收站，可在回收站中恢复`, {
                            type: "success",
                            title: "已删除",
                          });
                        }
                      }
                    );
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  批量删除
                </button>
              </>
            )}
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                setContextMenuAt(null);
                clearSelection();
              }}
            >
              <X className="h-4 w-4" />
              取消选择
            </button>
          </div>
        )}

        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="min-w-[980px] w-full table-fixed text-left text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="w-10 px-4 py-3" aria-label="选择" />
                <th className="w-[170px] px-4 py-3 text-center font-medium">客户名称</th>
                <th className="w-[120px] px-4 py-3 text-center font-medium">联系人</th>
                <th className="w-[96px] px-4 py-3 text-center font-medium">城市</th>
                <th className="w-[110px] px-4 py-3 text-center font-medium">行业</th>
                <th className="w-[130px] px-4 py-3 text-center font-medium">线索来源</th>
                <th className="w-[130px] px-4 py-3 text-center font-medium">联系方式</th>
                <th className="w-[120px] px-4 py-3 text-center font-medium">创建日期</th>
                <th className="w-[130px] px-4 py-3 text-center font-medium">销售人员</th>
                <th className="w-[110px] px-4 py-3 text-center font-medium">状态</th>
                <th className="w-[120px] px-4 py-3 text-center font-medium" title="线索→商机→客户，高亮为当前阶段">
                  流转阶段
                </th>
                <th className="w-[130px] px-4 py-3 text-center font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="[&_td]:text-center">
              {displayedData.length === 0 && !hasActiveFilters ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    暂无数据，点击「新建线索」增加一行后在表格内编辑
                  </td>
                </tr>
              ) : displayedData.length === 0 && hasActiveFilters ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    没有符合筛选条件的数据
                  </td>
                </tr>
              ) : (
                displayedData.map((lead) => (
                  <Fragment key={lead.id}>
                    <tr
                      id={`lead-row-${lead.id}`}
                      className={`border-b last:border-0 hover:bg-muted/30 ${highlightId === lead.id ? "animate-highlight-row" : ""} ${selectedIds.has(lead.id) ? "bg-primary/5" : ""}`}
                    >
                      <LeadRowCheckbox
                        leadId={lead.id}
                        checked={selectedIds.has(lead.id)}
                        onToggle={toggleSelectOne}
                      />
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <div className="relative inline-flex items-center">
                            {lead.isKeyFocus && (
                              <span
                                className="absolute right-full mr-0.5 top-1/2 -translate-y-1/2"
                                title={lead.keyFocusByAdmin ? "管理员标记为重点" : "重点关注"}
                                aria-hidden
                              >
                                <Star
                                  className={cn(
                                    "h-4 w-4",
                                    lead.keyFocusByAdmin ? "fill-blue-500 text-blue-500" : "fill-amber-400 text-amber-500"
                                  )}
                                />
                              </span>
                            )}
                            {renderLeadCell(
                              lead,
                              "customerName",
                              lead.customerName,
                              { title: lead.customerName }
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {renderLeadCell(lead, "contactPerson", lead.contactPerson || "-")}
                      </td>
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
                          currentAssigneeIds={lead.assignees.map((a) => a.userId)}
                          users={users}
                          canAssign={isAdmin}
                          onOptimisticUpdate={(newIds) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.id === lead.id
                                  ? {
                                    ...r,
                                    assignees: newIds
                                      .map((id) => {
                                        const u = users.find((x) => x.id === id);
                                        return u ? { userId: id, user: u } : null;
                                      })
                                      .filter(Boolean) as { userId: string; user: { id: string; name: string } }[],
                                  }
                                  : r
                              )
                            )
                          }
                          onRevert={(prevIds) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.id === lead.id
                                  ? {
                                    ...r,
                                    assignees: prevIds
                                      .map((id) => {
                                        const u = users.find((x) => x.id === id);
                                        return u ? { userId: id, user: u } : null;
                                      })
                                      .filter(Boolean) as { userId: string; user: { id: string; name: string } }[],
                                  }
                                  : r
                              )
                            )
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <LeadStatusSelect
                          leadId={lead.id}
                          currentStatus={lead.status}
                          onOptimisticUpdate={(newStatus) =>
                            setRows((prev) =>
                              prev.map((r) => (r.id === lead.id ? { ...r, status: newStatus } : r))
                            )
                          }
                          onRevert={(prevStatus) =>
                            setRows((prev) =>
                              prev.map((r) => (r.id === lead.id ? { ...r, status: prevStatus } : r))
                            )
                          }
                          onSuccess={(newStatus) => {
                            if (newStatus === "有意向") doRefresh();
                          }}
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
                              {(isAdmin || (canEditLead(lead) && !lead.keyFocusByAdmin)) && (
                                <DropdownMenuItem
                                  onClick={async () => {
                                    const result = await toggleLeadKeyFocusAction(lead.id);
                                    if (result && "error" in result && result.error) {
                                      showAlert(result.error ?? "操作失败", { type: "error", title: "操作失败" });
                                      return;
                                    }
                                    if (result && "success" in result && result.success) {
                                      setRows((prev) =>
                                        prev.map((r) =>
                                          r.id === lead.id
                                            ? { ...r, isKeyFocus: result.isKeyFocus, keyFocusByAdmin: isAdmin ? result.isKeyFocus : r.keyFocusByAdmin }
                                            : r
                                        )
                                      );
                                      showAlert(
                                        result.isKeyFocus ? "已标记为重点关注" : "已取消重点关注",
                                        { type: "success", title: "已更新" }
                                      );
                                    }
                                  }}
                                >
                                  <Star
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      lead.keyFocusByAdmin && "fill-blue-500 text-blue-500",
                                      lead.isKeyFocus && !lead.keyFocusByAdmin && "fill-amber-400 text-amber-500"
                                    )}
                                  />
                                  {lead.isKeyFocus ? "取消重点关注" : "标记为重点关注"}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => setDetailLeadId(lead.id)}>
                                <FileText className="mr-2 h-4 w-4" />
                                查看记录
                              </DropdownMenuItem>
                              {!isAdmin && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    void handleAddToMyMonthlyPlan([lead.id]);
                                  }}
                                >
                                  <CalendarDays className="mr-2 h-4 w-4" />
                                  纳入我的本月计划
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => toggleExpandedLead(lead.id)}>
                                {expandedLeadIds.has(lead.id) ? (
                                  <ChevronUp className="mr-2 h-4 w-4" />
                                ) : (
                                  <ChevronDown className="mr-2 h-4 w-4" />
                                )}
                                {expandedLeadIds.has(lead.id) ? "收起跟进时间线" : "展开跟进时间线"}
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
                                            // 若删除的是当前高亮线索，移除 URL 中的 highlight 避免重定向异常
                                            const params = new URLSearchParams(searchParams.toString());
                                            if (params.get("highlight") === lead.id) {
                                              params.delete("highlight");
                                              const qs = params.toString();
                                              router.replace(qs ? `${pathname}?${qs}` : pathname);
                                            }
                                            doRefresh();
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
                            <div className="mb-3 flex items-center justify-between">
                              <h4 className="font-semibold text-gray-900 text-left">
                                跟进时间线
                              </h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                                onClick={() => toggleExpandedLead(lead.id)}
                              >
                                <ChevronUp className="h-4 w-4" />
                                收起
                              </Button>
                            </div>
                            <FollowUpTimeline
                              leadId={lead.id}
                              currentUserRole={currentUserRole}
                              currentUserId={currentUserId}
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

        {/* 批量指定负责人对话框 */}
        <Dialog open={batchAssignOpen} onOpenChange={setBatchAssignOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>批量追加负责人</DialogTitle>
              <DialogDescription>
                已选 {selectedIds.size} 条线索。选择负责人后将为这些线索追加该负责人，并自动生成一条默认跟进说明，您可在下方补充更多说明。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="bulk-sales-person">负责人</Label>
                <Select
                  value={batchAssignSalesPersonId}
                  onValueChange={setBatchAssignSalesPersonId}
                >
                  <SelectTrigger id="bulk-sales-person" className="w-full">
                    <SelectValue placeholder="选择负责人" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {batchAssignSalesPersonId && (() => {
                  const selectedPerson = users.find((u) => u.id === batchAssignSalesPersonId);
                  const alreadyAssignedCount = Array.from(selectedIds).filter(
                    (id) => rows.find((r) => r.id === id)?.assignees?.some((a) => a.userId === batchAssignSalesPersonId)
                  ).length;
                  const toUpdateCount = selectedIds.size - alreadyAssignedCount;
                  if (alreadyAssignedCount === selectedIds.size) {
                    return (
                      <p className="text-sm text-muted-foreground">
                        所选 {selectedIds.size} 条线索均已包含负责人 <strong>{selectedPerson?.name}</strong>，提交后将不会变更。
                      </p>
                    );
                  }
                  if (alreadyAssignedCount > 0) {
                    return (
                      <p className="text-sm text-muted-foreground">
                        所选 {selectedIds.size} 条中，{alreadyAssignedCount} 条已包含负责人 <strong>{selectedPerson?.name}</strong>，提交后将只更新其余 {toUpdateCount} 条。
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-muted-foreground">默认跟进说明</Label>
                  <span className="text-xs text-muted-foreground">随所选销售人员自动更新</span>
                </div>
                <div
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm",
                    batchAssignSalesPersonId
                      ? "border-input bg-muted/40 text-foreground"
                      : "border-dashed bg-muted/20 text-muted-foreground"
                  )}
                  aria-live="polite"
                >
                  {batchAssignSalesPersonId ? (
                    <>批量线索新增负责人 {users.find((u) => u.id === batchAssignSalesPersonId)?.name ?? ""}</>
                  ) : (
                    "请先选择负责人，将自动生成"
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-supplement">补充说明（选填）</Label>
                <textarea
                  id="bulk-supplement"
                  value={batchAssignSupplement}
                  onChange={(e) => setBatchAssignSupplement(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="可在此补充更多说明，将接在默认说明下方"
                />
              </div>
              {batchAssignError && (
                <p className="text-sm text-destructive">{batchAssignError}</p>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBatchAssignOpen(false)}
                disabled={batchAssignLoading}
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={handleBatchAssignSubmit}
                disabled={batchAssignLoading}
                className="gap-2"
              >
                {batchAssignLoading ? (
                  <LoadingSpinner type="arc" size={16} className="shrink-0" />
                ) : null}
                确定
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 分配至本月计划对话框 */}
        <Dialog open={monthlyPlanOpen} onOpenChange={setMonthlyPlanOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>分配至本月计划</DialogTitle>
              <DialogDescription>
                已选 {selectedIds.size} 条线索。选择跟进人后，这些线索将加入其本月计划（可多选，同一条线索可同时加入多人）。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>跟进人（可多选）</Label>
                <div className="max-h-[200px] overflow-y-auto rounded-md border border-input p-2 space-y-2">
                  {users.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5"
                    >
                      <input
                        type="checkbox"
                        checked={monthlyPlanUserIds.has(u.id)}
                        onChange={(e) => {
                          setMonthlyPlanUserIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(u.id);
                            else next.delete(u.id);
                            return next;
                          });
                        }}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-sm">{u.name}</span>
                    </label>
                  ))}
                </div>
                {monthlyPlanUserIds.size > 0 && (
                  <p className="text-sm text-muted-foreground">
                    已选 {monthlyPlanUserIds.size} 人，{selectedIds.size} 条线索将加入其 {new Date().getFullYear()} 年 {new Date().getMonth() + 1} 月计划
                  </p>
                )}
              </div>
              {monthlyPlanError && (
                <p className="text-sm text-destructive">{monthlyPlanError}</p>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMonthlyPlanOpen(false)}
                disabled={monthlyPlanLoading}
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={handleMonthlyPlanSubmit}
                disabled={monthlyPlanLoading || monthlyPlanUserIds.size === 0}
                className="gap-2"
              >
                {monthlyPlanLoading ? (
                  <LoadingSpinner type="arc" size={16} className="shrink-0" />
                ) : null}
                确定
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 查看记录：右侧滑层展示完整字段并支持行内编辑 */}
        <Sheet open={!!detailLeadId} onOpenChange={(open) => !open && setDetailLeadId(null)}>
          <SheetContent side="right" className="flex flex-col overflow-hidden">
            {(() => {
              const lead = detailLeadId ? rows.find((l) => l.id === detailLeadId) : null;
              if (!lead) return null;
              const detailRows: { key: string; label: string; editable: boolean }[] = [
                { key: "customerName", label: "客户名称", editable: true },
                { key: "nickname", label: "昵称", editable: true },
                { key: "contactPerson", label: "联系人", editable: true },
                { key: "contactPhone", label: "联系方式", editable: true },
                { key: "contactEmail", label: "联系人邮箱", editable: true },
                { key: "address", label: "地址", editable: true },
                { key: "city", label: "城市", editable: true },
                { key: "industry", label: "行业", editable: true },
                { key: "leadSource", label: "线索来源", editable: true },
                { key: "customerTier", label: "客户等级", editable: true },
                { key: "remark", label: "线索备注", editable: true },
                { key: "createdAt", label: "创建时间", editable: false },
                { key: "assignees", label: "负责人", editable: true },
                { key: "status", label: "状态", editable: true },
              ];
              return (
                <>
                  <SheetHeader className="shrink-0 border-b pb-3 text-left">
                    <SheetTitle>线索详情 · {lead.customerName}</SheetTitle>
                  </SheetHeader>
                  <SheetScrollArea>
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
                          {key === "assignees" && (
                            <LeadSalesPersonSelect
                              leadId={lead.id}
                              currentAssigneeIds={lead.assignees.map((a) => a.userId)}
                              users={users}
                              canAssign={isAdmin}
                              onOptimisticUpdate={(newIds) =>
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.id === lead.id
                                      ? {
                                        ...r,
                                        assignees: newIds
                                          .map((id) => {
                                            const u = users.find((x) => x.id === id);
                                            return u ? { userId: id, user: u } : null;
                                          })
                                          .filter(Boolean) as { userId: string; user: { id: string; name: string } }[],
                                      }
                                      : r
                                  )
                                )
                              }
                              onRevert={(prevIds) =>
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.id === lead.id
                                      ? {
                                        ...r,
                                        assignees: prevIds
                                          .map((id) => {
                                            const u = users.find((x) => x.id === id);
                                            return u ? { userId: id, user: u } : null;
                                          })
                                          .filter(Boolean) as { userId: string; user: { id: string; name: string } }[],
                                      }
                                      : r
                                  )
                                )
                              }
                            />
                          )}
                          {key === "status" && (
                            <LeadStatusSelect
                              leadId={lead.id}
                              currentStatus={lead.status}
                              onOptimisticUpdate={(newStatus) =>
                                setRows((prev) =>
                                  prev.map((r) => (r.id === lead.id ? { ...r, status: newStatus } : r))
                                )
                              }
                              onRevert={(prevStatus) =>
                                setRows((prev) =>
                                  prev.map((r) => (r.id === lead.id ? { ...r, status: prevStatus } : r))
                                )
                              }
                              onSuccess={(newStatus) => {
                                if (newStatus === "有意向") doRefresh();
                              }}
                            />
                          )}
                          {editable && key !== "createdAt" && key !== "assignees" && key !== "status" && (
                            renderLeadCell(lead, key, getLeadFieldValue(lead, key) || "-", { align: "left" })
                          )}
                        </div>
                      </div>
                    ))}

                    {(lead.importSource ||
                      (lead.extraFields &&
                        typeof lead.extraFields === "object" &&
                        !Array.isArray(lead.extraFields) &&
                        Object.keys(lead.extraFields).length > 0)) && (
                        <div className="mt-4 space-y-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                          <div className="font-medium text-foreground">其他信息（只读）</div>
                          {lead.importSource && (
                            <div>
                              <span className="font-medium">导入来源：</span>
                              <span>{lead.importSource}</span>
                            </div>
                          )}
                          {lead.extraFields &&
                            typeof lead.extraFields === "object" &&
                            !Array.isArray(lead.extraFields) &&
                            Object.keys(lead.extraFields).length > 0 && (
                              <div className="mt-1 space-y-1">
                                {Object.entries(lead.extraFields as Record<string, unknown>).map(
                                  ([key, value]) => (
                                    <div key={key} className="flex gap-1">
                                      <span className="min-w-[72px] shrink-0 text-muted-foreground">
                                        {key}：
                                      </span>
                                      <span className="break-all">
                                        {typeof value === "object"
                                          ? JSON.stringify(value)
                                          : String(value ?? "")}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                        </div>
                      )}

                    <div className="mt-6 pt-4 border-t">
                      <h4 className="mb-3 text-sm font-semibold text-foreground">跟进时间线</h4>
                      <FollowUpTimeline
                        leadId={lead.id}
                        currentUserRole={currentUserRole}
                        currentUserId={currentUserId}
                        refreshKey={followUpRefreshKeys[lead.id] ?? 0}
                      />
                    </div>
                  </SheetScrollArea>
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
              doRefresh();
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
                  doRefresh();
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
                        doRefresh();
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
                      doRefresh();
                      return;
                    }
                    setSyncToCustomerDialog(null);
                    doRefresh();
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
