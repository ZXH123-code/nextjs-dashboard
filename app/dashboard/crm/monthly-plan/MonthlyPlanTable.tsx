"use client";

import { Fragment, useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterDialog, type FilterField, type FilterCondition, type FilterGroup } from "@/components/ui/filter-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star, Circle, CheckCircle, Minus, ArrowRight, Building2, ExternalLink, ChevronDown, ChevronUp, FileText, Filter, X, ArrowUpDown, MessageSquarePlus, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlert } from "@/hooks/use-alert";
import { createManualFollowUpAction } from "@/app/lib/crm-actions";
import { LeadStatusSelect } from "../leads/LeadStatusSelect";
import { WriteFollowUpDialog } from "../components/WriteFollowUpDialog";
import { FollowUpTimeline } from "../components/FollowUpTimeline";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetScrollArea } from "@/components/ui/sheet-scroll-area";
import type { MonthlyPlanLeadItem, MonthlyPlanStatsByUser } from "@/app/lib/crm";
import { LEAD_STATUS } from "@/app/lib/crm-constants";

function getLeadFieldValue(lead: MonthlyPlanLeadItem, field: string): string {
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
}

function ConversionBadge({ status }: { status: "未转化" | "已转商机" | "已转客户" }) {
  const config = {
    未转化: { icon: Minus, variant: "outline" as const, iconClass: "text-muted-foreground/80" },
    已转商机: { icon: ArrowRight, variant: "secondary" as const, iconClass: "text-muted-foreground/80" },
    已转客户: { icon: Building2, variant: "default" as const, iconClass: "text-primary-foreground/90" },
  };
  const { icon: Icon, variant, iconClass } = config[status] ?? config.未转化;
  return (
    <Badge variant={variant} className="inline-flex items-center gap-1.5 text-xs">
      <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClass)} />
      {status}
    </Badge>
  );
}

export function MonthlyPlanTable({
  items,
  total,
  page,
  pageSize,
  totalPages,
  statsByUser,
  isAdmin,
  currentUserRole,
  currentUserId,
  initialFilter,
  filterParam,
  sortBy,
  sortOrder,
}: {
  items: MonthlyPlanLeadItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statsByUser: MonthlyPlanStatsByUser[];
  isAdmin: boolean;
  currentUserRole?: string;
  currentUserId?: string;
  initialFilter?: { groups: FilterGroup[] };
  filterParam?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showAlert, AlertComponent } = useAlert();
  const [rows, setRows] = useState<MonthlyPlanLeadItem[]>(items);
  const [expandedLeadIds, setExpandedLeadIds] = useState<Set<string>>(new Set());
  const [followUpRefreshKeys, setFollowUpRefreshKeys] = useState<Record<string, number>>({});
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [writeFollowUpLeadId, setWriteFollowUpLeadId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setRows(items);
  }, [items]);

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
      router.refresh();
    } catch (error) {
      console.error("添加跟进记录失败:", error);
      showAlert("添加跟进记录失败", { type: "error", title: "操作失败" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentWriteFollowUpLead = rows.find((l) => l.id === writeFollowUpLeadId);

  const filterFields: FilterField[] = [
    { key: "customerName", label: "客户名称", type: "text" },
    { key: "contactPerson", label: "联系人", type: "text" },
    { key: "nickname", label: "昵称", type: "text" },
    { key: "city", label: "城市", type: "text" },
    { key: "industry", label: "行业", type: "text" },
    { key: "leadSource", label: "线索来源", type: "text" },
    { key: "status", label: "状态", type: "select", options: LEAD_STATUS.map((s) => ({ value: s, label: s })) },
    { key: "assignees.name", label: "负责人", type: "text" },
    { key: "isKeyFocus", label: "重点关注", type: "boolean" },
    { key: "keyFocusByAdmin", label: "管理员标注", type: "boolean" },
    { key: "createdAt", label: "创建时间", type: "date" },
  ];

  const groups = useMemo<FilterGroup[]>(
    () => initialFilter?.groups?.filter((g) => g.conditions?.length) ?? [],
    [initialFilter]
  );
  const hasActiveFilters = groups.length > 0;
  const activeFilterCount = groups.reduce((s, g) => s + g.conditions.length, 0);

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

  const preserveParams = useMemo(() => {
    const p: Record<string, string | undefined> = {};
    if (filterParam) p.filter = filterParam;
    if (sortBy) p.sortBy = sortBy;
    if (sortOrder) p.sortOrder = sortOrder;
    return p;
  }, [filterParam, sortBy, sortOrder]);

  const toggleExpandedLead = (leadId: string) => {
    setExpandedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <AlertComponent />
      {isAdmin && statsByUser.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">人员汇总</h2>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">销售人员</th>
                  <th className="px-4 py-3 text-center font-medium">计划线索</th>
                  <th className="px-4 py-3 text-center font-medium">已联系</th>
                  <th className="px-4 py-3 text-center font-medium">转化商机</th>
                  <th className="px-4 py-3 text-center font-medium">转化客户</th>
                </tr>
              </thead>
              <tbody>
                {statsByUser.map((row) => (
                  <tr key={row.userId} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{row.userName}</td>
                    <td className="px-4 py-3 text-center">{row.total}</td>
                    <td className="px-4 py-3 text-center">{row.contacted}</td>
                    <td className="px-4 py-3 text-center">{row.opportunityCount}</td>
                    <td className="px-4 py-3 text-center">{row.customerCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">线索简情</h2>
        <div className="mb-3 flex items-center justify-between">
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
          </div>
          <div className="text-sm text-muted-foreground">
            {total === 0
              ? "共 0 条"
              : `共 ${total} 条，当前第 ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} 条`}
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
        <div className="rounded-lg border overflow-x-auto">
          <table className="min-w-[958px] w-full table-fixed text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="w-[160px] px-4 py-3 text-center font-medium">客户名称</th>
                <th className="w-[72px] px-4 py-3 text-center font-medium">城市</th>
                <th className="w-[88px] px-4 py-3 text-center font-medium">行业</th>
                <th className="w-[100px] px-4 py-3 text-center font-medium">线索来源</th>
                <th className="w-[110px] px-4 py-3 text-center font-medium">状态</th>
                <th className="w-[72px] px-4 py-3 text-center font-medium" title="本月是否有跟进记录">本月已联系</th>
                <th className="w-[100px] px-4 py-3 text-center font-medium">转化状态</th>
                <th className="w-[118px] px-4 py-3 text-center font-medium">负责人</th>
                <th className="w-[148px] px-2 py-3 text-center font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    暂无本月计划线索，请在线索管理表中勾选后右键「分配至本月计划」
                  </td>
                </tr>
              ) : (
                rows.map((lead) => (
                  <Fragment key={lead.id}>
                    <tr className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/dashboard/crm/leads?highlight=${lead.id}`}
                          className="inline-flex max-w-[150px] items-center gap-1 truncate text-primary underline decoration-primary/50 hover:decoration-primary cursor-pointer"
                          title={lead.customerName ? "点击跳转到线索并高亮" : undefined}
                        >
                          {lead.isKeyFocus && (
                            <Star
                              className={cn(
                                "h-4 w-4 shrink-0",
                                lead.keyFocusByAdmin ? "fill-blue-500 text-blue-500" : "fill-amber-400 text-amber-500"
                              )}
                            />
                          )}
                          <span className="min-w-0 truncate">{lead.customerName}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {lead.city ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        <span className="inline-block max-w-[80px] truncate align-middle" title={lead.industry ?? undefined}>
                          {lead.industry ?? "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        <span className="inline-block max-w-[90px] truncate align-middle" title={lead.leadSource ?? undefined}>
                          {lead.leadSource ?? "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
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
                          onSuccess={() => {
                            router.refresh();
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-center" title={lead.hasFollowUpThisMonth ? "本月已有跟进记录" : "本月尚未联系"}>
                        {lead.hasFollowUpThisMonth ? (
                          <CheckCircle className="h-4 w-4 text-emerald-600/90 mx-auto" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/60 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ConversionBadge status={lead.conversionStatus} />
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {lead.assignees?.map((a) => a.user.name).join("、") ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setWriteFollowUpLeadId(lead.id)}
                          >
                            <MessageSquarePlus className="h-3.5 w-3.5" />
                            写跟进
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-0.5 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5 shrink-0" />
                                更多
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetailLeadId(lead.id)}>
                                <FileText className="mr-2 h-4 w-4" />
                                查看详情
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleExpandedLead(lead.id)}>
                                {expandedLeadIds.has(lead.id) ? (
                                  <ChevronUp className="mr-2 h-4 w-4" />
                                ) : (
                                  <ChevronDown className="mr-2 h-4 w-4" />
                                )}
                                {expandedLeadIds.has(lead.id) ? "收起跟进时间线" : "展开跟进时间线"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                    {expandedLeadIds.has(lead.id) && (
                      <tr>
                        <td colSpan={9} className="bg-muted/30 px-4 py-4 align-top">
                          <div className="rounded-lg border bg-background p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-foreground">跟进时间线</h4>
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
      </section>

      {/* 线索详情抽屉 */}
      <Sheet open={!!detailLeadId} onOpenChange={(open) => !open && setDetailLeadId(null)}>
        <SheetContent side="right" className="flex flex-col overflow-hidden">
          {(() => {
            const lead = detailLeadId ? rows.find((l) => l.id === detailLeadId) : null;
            if (!lead) return null;
            const detailRows: { key: string; label: string }[] = [
              { key: "customerName", label: "客户名称" },
              { key: "nickname", label: "昵称" },
              { key: "contactPerson", label: "联系人" },
              { key: "contactPhone", label: "联系方式" },
              { key: "contactEmail", label: "联系人邮箱" },
              { key: "address", label: "地址" },
              { key: "city", label: "城市" },
              { key: "industry", label: "行业" },
              { key: "leadSource", label: "线索来源" },
              { key: "customerTier", label: "客户等级" },
              { key: "remark", label: "线索备注" },
              { key: "createdAt", label: "创建时间" },
              { key: "assignees", label: "负责人" },
              { key: "status", label: "状态" },
            ];
            return (
              <>
                <SheetHeader className="shrink-0 space-y-3 border-b pb-3 text-left">
                  <div className="flex flex-wrap items-start justify-between gap-2 pr-8">
                    <SheetTitle className="text-left">线索详情 · {lead.customerName}</SheetTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0 gap-1.5"
                      onClick={() => setWriteFollowUpLeadId(lead.id)}
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                      写跟进
                    </Button>
                  </div>
                </SheetHeader>
                <SheetScrollArea>
                  {detailRows.map(({ key, label }) => (
                    <div key={key} className="space-y-1.5 text-left">
                      <div className="text-xs font-medium text-muted-foreground">{label}</div>
                      <div className="min-h-[32px] flex items-center text-sm justify-start text-left w-full max-w-sm pl-1">
                        {key === "createdAt" && (
                          <span className="text-muted-foreground">
                            {lead.createdAt instanceof Date
                              ? lead.createdAt.toLocaleString("zh-CN")
                              : lead.createdAt
                                ? new Date(lead.createdAt as string).toLocaleString("zh-CN")
                                : "-"}
                          </span>
                        )}
                        {key === "assignees" && (
                          <span className="text-foreground">
                            {lead.assignees?.map((a) => a.user.name).join("、") ?? "-"}
                          </span>
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
                            onSuccess={() => {
                              router.refresh();
                            }}
                          />
                        )}
                        {!["createdAt", "assignees", "status"].includes(key) && (
                          <span className="text-foreground">
                            {getLeadFieldValue(lead, key) || "-"}
                          </span>
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
                                ([k, value]) => (
                                  <div key={k} className="flex gap-1">
                                    <span className="min-w-[72px] shrink-0 text-muted-foreground">
                                      {k}：
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

      {currentWriteFollowUpLead && (
        <WriteFollowUpDialog
          isOpen
          onClose={() => setWriteFollowUpLeadId(null)}
          onConfirm={handleWriteFollowUp}
          recordType="线索"
          recordName={currentWriteFollowUpLead.customerName}
          isSubmitting={isSubmitting}
        />
      )}

      {total > 0 && (
        <Pagination
          basePath="/dashboard/crm/monthly-plan"
          currentPage={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          preserveParams={Object.keys(preserveParams).length > 0 ? preserveParams : undefined}
          showPageSizeSelector
        />
      )}
    </div>
  );
}
