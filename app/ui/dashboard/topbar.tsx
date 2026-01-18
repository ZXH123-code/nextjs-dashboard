"use client";

import { usePathname } from "next/navigation";
import {
  Bell,
  User,
  Search,
  Plus,
  HelpCircle,
  Settings,
  ChevronRight,
  Command,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function TopBar() {
  const pathname = usePathname();
  const [searchFocused, setSearchFocused] = useState(false);

  // 获取面包屑路径
  const getBreadcrumbs = () => {
    const segments = pathname.split("/").filter(Boolean);
    const breadcrumbs = [{ name: "首页", path: "/dashboard" }];

    let currentPath = "";
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      if (index > 0) { // 跳过 'dashboard'
        const names: Record<string, string> = {
          orders: "订单中心",
          suppliers: "供应商",
          logistics: "物流",
          finance: "财务",
          system: "系统",
          invoices: "Invoices",
          customers: "Customers",
          list: "列表",
          exceptions: "异常监控",
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
  const unreadCount = 3; // 未读通知数

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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

          {/* 智能搜索框 */}
          <div className="hidden lg:flex items-center flex-1 max-w-md">
            <div
              className={cn(
                "relative w-full group transition-all duration-200",
                searchFocused && "scale-[1.02]"
              )}
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <input
                type="text"
                placeholder="搜索订单、供应商、物流单号..."
                className={cn(
                  "w-full h-10 pl-10 pr-20 rounded-lg border bg-muted/50 text-sm transition-all duration-200",
                  "placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent focus:bg-background",
                  "hover:bg-muted"
                )}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              {/* 快捷键提示 */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
                <Command className="h-3 w-3" />
                <span>K</span>
              </div>
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

          {/* AI 助手 (小巧思) */}
          <button
            type="button"
            title="AI 智能助手"
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

          {/* 用户菜单 */}
          <button
            type="button"
            title="用户中心"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200",
              "bg-gradient-to-br from-blue-500 to-cyan-500 text-white",
              "hover:shadow-lg hover:shadow-blue-500/50 hover:scale-110",
              "active:scale-95 ring-2 ring-background"
            )}
          >
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 底部装饰性渐变线 */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
    </header>
  );
}
