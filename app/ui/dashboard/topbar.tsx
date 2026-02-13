"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  User,
  Search,
  Plus,
  HelpCircle,
  Settings,
  ChevronRight,
  ChevronLeft,
  Command,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getNotificationsForCurrentUserAction,
  markMyNotificationsAsReadAction,
  globalSearchCrmAction,
} from "@/app/lib/crm-actions";
import type { GlobalSearchItem, GlobalSearchResult } from "@/app/lib/crm";
import { AiQuerySheet } from "./ai-query-sheet";

type NotificationItem = Awaited<ReturnType<typeof getNotificationsForCurrentUserAction>>[number];

function formatNotificationTime(date: Date) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins} 分钟前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} 天前`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getNotificationLabel(n: NotificationItem, userId: string): string {
  const leadName = n.lead?.customerName ?? "未知线索";
  if (n.newSalesPersonId === userId) return `被指派：线索「${leadName}」`;
  if (n.oldSalesPersonId === userId) return `被转走：线索「${leadName}」`;
  return `线索「${leadName}」`;
}

const SEARCH_PAGE_SIZE = 5;

// 骨架扫光动画（与 app/ui/skeletons.tsx 一致，深色模式用 via-white/30）
const skeletonShimmer =
  "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent dark:before:via-white/20";

/** 搜索下拉单列骨架（列表区：约 5 条占位 + 扫光） */
function SearchColumnSkeleton() {
  return (
    <ul className="max-h-[200px] overflow-hidden shrink min-h-0 space-y-0">
      {[1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="px-2 py-2 border-b last:border-b-0">
          <div className={cn("h-4 w-[85%] rounded bg-muted mb-1.5", skeletonShimmer)} />
          <div className={cn("h-3 w-[60%] rounded bg-muted/80", skeletonShimmer)} />
        </li>
      ))}
    </ul>
  );
}

/** 搜索下拉全量骨架：三栏布局，与真实结果一致 */
function SearchDropdownSkeleton() {
  return (
    <div className="flex divide-x">
      {(["线索", "商机", "客户"] as const).map((label) => (
        <div key={label} className="flex-1 min-w-0 flex flex-col">
          <div className="px-2 py-1.5 border-b bg-muted/40 shrink-0">
            <div className={cn("h-3.5 w-14 rounded bg-muted", skeletonShimmer)} />
          </div>
          <SearchColumnSkeleton />
          <div className="flex items-center justify-center gap-1 px-2 py-1.5 border-t bg-muted/30 shrink-0">
            <div className={cn("h-3.5 w-3.5 rounded bg-muted", skeletonShimmer)} />
            <div className={cn("h-3 w-10 rounded bg-muted", skeletonShimmer)} />
            <div className={cn("h-3.5 w-3.5 rounded bg-muted", skeletonShimmer)} />
          </div>
        </div>
      ))}
    </div>
  );
}

const typeLabels: Record<GlobalSearchItem["type"], string> = {
  lead: "线索",
  opportunity: "商机",
  customer: "客户",
};
const typePaths: Record<GlobalSearchItem["type"], string> = {
  lead: "/dashboard/crm/leads",
  opportunity: "/dashboard/crm/opportunities",
  customer: "/dashboard/crm/customers",
};

export default function TopBar({ userName, userId }: { userName?: string; userId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchLeadPage, setSearchLeadPage] = useState(0);
  const [searchOppPage, setSearchOppPage] = useState(0);
  const [searchCustomerPage, setSearchCustomerPage] = useState(0);
  const [searchResult, setSearchResult] = useState<GlobalSearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSectionLoading, setSearchSectionLoading] = useState<Record<"lead" | "opportunity" | "customer", boolean>>({
    lead: false,
    opportunity: false,
    customer: false,
  });
  const searchClosedRef = useRef(false);

  const fetchSearch = useCallback(
    async (
      keyword: string,
      leadPage: number,
      oppPage: number,
      customerPage: number,
      sectionOnly?: "lead" | "opportunity" | "customer"
    ) => {
      if (!keyword.trim()) {
        setSearchResult(null);
        return;
      }
      searchClosedRef.current = false;
      if (sectionOnly) {
        setSearchSectionLoading((prev) => ({ ...prev, [sectionOnly]: true }));
      } else {
        // 新搜索开始时先清空结果，避免短暂显示上一次结果或全 0 的闪屏
        setSearchResult(null);
        setSearchLoading(true);
      }
      try {
        const res = await globalSearchCrmAction(keyword.trim(), leadPage, oppPage, customerPage);
        if (searchClosedRef.current) return;
        // 仅在有有效数据时更新；null/undefined 时保持为 null，由 UI 显示「未找到相关记录」
        if (res) {
          setSearchResult(res);
        }
      } catch {
        if (searchClosedRef.current) return;
        // 错误时不展示三栏 0 条，保持 null，显示「未找到相关记录」
        setSearchResult(null);
      } finally {
        if (!searchClosedRef.current) {
          if (sectionOnly) {
            setSearchSectionLoading((prev) => ({ ...prev, [sectionOnly]: false }));
          } else {
            setSearchLoading(false);
          }
        }
      }
    },
    []
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchKeyword.trim()) {
        setSearchLeadPage(0);
        setSearchOppPage(0);
        setSearchCustomerPage(0);
        fetchSearch(searchKeyword, 0, 0, 0);
      } else {
        setSearchResult(null);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchKeyword, fetchSearch]);

  const goSearchPage = useCallback(
    (
      type: "lead" | "opportunity" | "customer",
      delta: number
    ) => {
      if (!searchResult) return;
      const setPage =
        type === "lead"
          ? setSearchLeadPage
          : type === "opportunity"
            ? setSearchOppPage
            : setSearchCustomerPage;
      const page =
        type === "lead"
          ? searchLeadPage
          : type === "opportunity"
            ? searchOppPage
            : searchCustomerPage;
      const section = searchResult[type === "lead" ? "leads" : type === "opportunity" ? "opportunities" : "customers"];
      const next = page + delta;
      if (next < 0 || next * SEARCH_PAGE_SIZE >= section.total) return;
      setPage(next);
      const newLeadPage = type === "lead" ? next : searchLeadPage;
      const newOppPage = type === "opportunity" ? next : searchOppPage;
      const newCustomerPage = type === "customer" ? next : searchCustomerPage;
      fetchSearch(searchKeyword, newLeadPage, newOppPage, newCustomerPage, type);
    },
    [searchKeyword, searchResult, searchLeadPage, searchOppPage, searchCustomerPage, fetchSearch]
  );

  const closeSearchDropdown = useCallback(() => {
    searchClosedRef.current = true;
    setSearchFocused(false);
    setSearchResult(null);
    setSearchLoading(false);
    setSearchSectionLoading({ lead: false, opportunity: false, customer: false });
  }, []);

  const handleSearchItemClick = useCallback(
    (item: GlobalSearchItem) => {
      const path = `${typePaths[item.type]}?highlight=${item.id}`;
      router.push(path);
      setSearchKeyword("");
      setSearchResult(null);
      setSearchFocused(false);
    },
    [router]
  );

  const fetchNotifications = useCallback(async () => {
    const list = await getNotificationsForCurrentUserAction();
    setNotifications(list ?? []);
  }, []);

  const handleNotificationOpenChange = useCallback(
    async (open: boolean) => {
      setNotificationOpen(open);
      if (open) {
        await fetchNotifications();
        // 查看后标记为已读，红点/数字自动消失
        await markMyNotificationsAsReadAction();
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, notified: true }))
        );
      }
    },
    [fetchNotifications]
  );

  // 获取面包屑路径
  const getBreadcrumbs = () => {
    const segments = pathname.split("/").filter(Boolean);
    const breadcrumbs = [{ name: "首页", path: "/dashboard" }];

    let currentPath = "";
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      if (index > 0) { // 跳过 'dashboard'
        const names: Record<string, string> = {
          profile: "个人信息",
          permissions: "权限管理",
          crm: "CRM",
          leads: "线索管理表",
          opportunities: "商机管理表",
          customers: "客户管理表",
          "follow-ups": "跟进记录",
          new: "新建",
          list: "列表",
          import: "导入",
        };
        breadcrumbs.push({
          name: names[segment] || segment,
          path: currentPath
        });
      }
    });

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();
  const unreadCount = notifications.filter((n) => !n.notified).length;

  const searchDropdownOpen = Boolean(
    searchKeyword.trim() && (searchLoading || searchResult !== null)
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* 搜索下拉展开时：透明遮罩挂到 body；z-[35] 高于主内容、低于 header(z-40)，这样下拉和滚动条在 header 内，不会被遮罩挡住 */}
      {searchDropdownOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[35]"
            onClick={closeSearchDropdown}
            onMouseDown={(e) => e.preventDefault()}
            aria-hidden
          />,
          document.body
        )}
      <div className="flex h-16 items-center justify-between px-4 md:px-6">

        {/* 左侧：面包屑 + 页面标题 */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* 面包屑导航 */}
          <nav className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.path} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
                <span
                  className={cn(
                    "transition-colors hover:text-foreground cursor-pointer",
                    index === breadcrumbs.length - 1 && "text-foreground font-medium"
                  )}
                >
                  {crumb.name}
                </span>
              </div>
            ))}
          </nav>

          {/* 智能搜索框 + 全局搜索下拉（在 header 内，自然高于遮罩 z-[35]） */}
          <div className="hidden lg:flex items-center flex-1 max-w-md relative">
            <div
              className={cn(
                "relative w-full group transition-all duration-200",
                searchFocused && "scale-[1.02]"
              )}
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors pointer-events-none z-10" />
              <input
                type="text"
                placeholder="搜索线索、商机、客户..."
                value={searchKeyword ?? ""}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                className={cn(
                  "w-full h-10 pl-10 pr-20 rounded-lg border bg-muted/50 text-sm transition-all duration-200",
                  "placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent focus:bg-background",
                  "hover:bg-muted"
                )}
              />
              {/* 快捷键提示 */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground pointer-events-none">
                <Command className="h-3 w-3" />
                <span>K</span>
              </div>

              {/* 搜索下拉：分栏显示线索 / 商机 / 客户，每表单独分页 */}
              {searchKeyword.trim() && (searchLoading || searchResult !== null) && (
                <div
                  className="absolute left-0 right-0 top-full mt-1 rounded-lg border bg-popover text-popover-foreground shadow-lg overflow-hidden w-[560px] max-w-[calc(100vw-2rem)]"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {searchLoading ? (
                    <SearchDropdownSkeleton />
                  ) : searchResult ? (
                    <div className="flex divide-x">
                      {(
                        [
                          {
                            key: "leads",
                            label: "线索",
                            section: searchResult.leads,
                            page: searchLeadPage,
                            type: "lead" as const,
                          },
                          {
                            key: "opportunities",
                            label: "商机",
                            section: searchResult.opportunities,
                            page: searchOppPage,
                            type: "opportunity" as const,
                          },
                          {
                            key: "customers",
                            label: "客户",
                            section: searchResult.customers,
                            page: searchCustomerPage,
                            type: "customer" as const,
                          },
                        ] as const
                      ).map(({ key, label, section, page, type }) => (
                        <div key={key} className="flex-1 min-w-0 flex flex-col relative">
                          <div className="px-2 py-1.5 border-b bg-muted/40 text-xs font-medium text-muted-foreground shrink-0">
                            {label}（共 {section.total} 条）
                          </div>
                          <div className="relative flex-1 min-h-0 flex flex-col">
                            <div className="relative flex-1 min-h-0 overflow-hidden">
                              {searchSectionLoading[type] && (
                                <div className="absolute inset-0 z-10 flex flex-col bg-background/90">
                                  <SearchColumnSkeleton />
                                </div>
                              )}
                              <ul className="max-h-[200px] overflow-y-auto overflow-x-hidden overscroll-contain shrink min-h-0">
                            {section.items.length === 0 ? (
                              <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                                无
                              </li>
                            ) : (
                              section.items.map((item) => (
                                <li key={item.id}>
                                  <button
                                    type="button"
                                    onClick={() => handleSearchItemClick(item)}
                                    className="w-full text-left px-2 py-2 hover:bg-muted/50 transition-colors border-b last:border-b-0 text-sm"
                                  >
                                    <div className="font-medium truncate">{item.title}</div>
                                    {item.subtitle && (
                                      <div className="text-xs text-muted-foreground truncate">
                                        {item.subtitle}
                                      </div>
                                    )}
                                  </button>
                                </li>
                              ))
                            )}
                              </ul>
                            </div>
                          {/* 每表单独分页：始终显示，便于看出是分栏分页；仅一页时按钮禁用 */}
                          <div className="flex items-center justify-center gap-1 px-2 py-1.5 border-t bg-muted/30 text-xs shrink-0">
                            <button
                              type="button"
                              disabled={page <= 0}
                              onClick={() => goSearchPage(type, -1)}
                              className="p-1 rounded hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
                              aria-label={`${label}上一页`}
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-muted-foreground min-w-[3.5rem] text-center">
                              {page + 1} / {Math.max(1, Math.ceil(section.total / SEARCH_PAGE_SIZE))}
                            </span>
                            <button
                              type="button"
                              disabled={section.total === 0 || (page + 1) * SEARCH_PAGE_SIZE >= section.total}
                              onClick={() => goSearchPage(type, 1)}
                              className="p-1 rounded hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
                              aria-label={`${label}下一页`}
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                      未找到相关记录
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：功能入口 */}
        <div className="flex items-center gap-2">
          {/* 快速创建按钮 */}
          <button
            type="button"
            className={cn(
              "hidden md:inline-flex items-center gap-2 h-9 px-4 rounded-lg",
              "bg-primary text-primary-foreground text-sm font-medium",
              "hover:bg-primary/90 transition-all duration-200 hover:shadow-md hover:scale-105",
              "active:scale-95"
            )}
          >
            <Plus className="h-4 w-4" />
            <span>新建</span>
          </button>

          {/* AI 助手 (问数) */}
          <button
            type="button"
            title="AI 智能助手"
            onClick={() => setAiSheetOpen(true)}
            className={cn(
              "relative inline-flex h-9 w-9 items-center justify-center rounded-lg",
              "bg-gradient-to-br from-purple-500/10 to-pink-500/10",
              "hover:from-purple-500/20 hover:to-pink-500/20",
              "border border-purple-500/20 transition-all duration-200",
              "hover:shadow-lg hover:shadow-purple-500/20 hover:scale-110",
              "active:scale-95"
            )}
          >
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-500"></span>
            </span>
          </button>

          {/* 帮助中心 */}
          <button
            type="button"
            title="帮助中心"
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200",
              "hover:bg-accent hover:text-accent-foreground hover:scale-110",
              "active:scale-95"
            )}
          >
            <HelpCircle className="h-5 w-5" />
          </button>

          {/* 分隔线 */}
          <div className="hidden md:block h-6 w-px bg-border" />

          {/* 通知中心 */}
          <DropdownMenu open={notificationOpen} onOpenChange={handleNotificationOpenChange}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="通知中心"
                className={cn(
                  "relative inline-flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200",
                  "hover:bg-accent hover:text-accent-foreground hover:scale-110",
                  "active:scale-95"
                )}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[320px] max-h-[360px] overflow-y-auto p-0">
              <div className="px-3 py-2 border-b text-sm font-medium text-muted-foreground">
                通知
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    暂无通知
                  </div>
                ) : (
                  notifications.map((n) => (
                    <Link
                      key={n.id}
                      href={userId ? `/dashboard/crm/leads?highlight=${n.leadId}` : "#"}
                      className="block px-3 py-2.5 text-sm border-b last:border-b-0 hover:bg-muted/50 transition-colors"
                    >
                      <div className={cn(!n.notified && "font-medium text-foreground")}>
                        {userId ? getNotificationLabel(n, userId) : getNotificationLabel(n, "")}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatNotificationTime(n.createdAt)}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 设置 */}
          <button
            type="button"
            title="系统设置"
            className={cn(
              "hidden md:inline-flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200",
              "hover:bg-accent hover:text-accent-foreground hover:rotate-90 hover:scale-110",
              "active:scale-95"
            )}
          >
            <Settings className="h-5 w-5" />
          </button>

          {/* 当前用户 + 用户中心 */}
          <Link
            href="/dashboard/profile"
            title="个人信息"
            className={cn(
              "flex items-center gap-2 h-9 pl-2 pr-2.5 rounded-full transition-all duration-200",
              "bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-sm font-medium",
              "hover:shadow-lg hover:shadow-blue-500/50 hover:scale-[1.02]",
              "active:scale-95 ring-2 ring-background"
            )}
          >
            <User className="h-4 w-4 shrink-0" />
            {userName && (
              <span className="hidden sm:inline max-w-[120px] truncate">
                {userName}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* 底部装饰性渐变线 */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <AiQuerySheet open={aiSheetOpen} onOpenChange={setAiSheetOpen} />
    </header>
  );
}
