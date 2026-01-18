"use client";

import Link from "next/link";
import NavLinks from "@/app/ui/dashboard/nav-links";
import { LogOut, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, createContext, useContext } from "react";
import { logout } from "@/app/lib/auth-actions";

// 创建 Context 来共享折叠状态
export const SidebarContext = createContext<{
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}>({
  collapsed: false,
  setCollapsed: () => { },
});

export const useSidebar = () => useContext(SidebarContext);

export default function SideNav() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {/* 外层容器 - 允许折叠按钮溢出 */}
      <div className="relative h-full">
        <aside
          className={cn(
            "relative h-full flex flex-col overflow-visible sidebar-transition",
            "bg-[var(--sidebar-bg)] text-[var(--sidebar-text)]",
            collapsed ? "w-[75px]" : "w-64"
          )}
        >
          {/* 折叠按钮 - 固定在右边缘中心，横跨边界 */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "absolute z-[100] hidden md:flex items-center justify-center",
              "w-6 h-6 rounded-full",
              "bg-[var(--sidebar-button)] text-white",
              "shadow-[0_2px_8px_rgba(0,0,0,0.3)]",
              "transition-all duration-300 hover:scale-110 hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)]",
              "right-0 top-[42px] translate-x-1/2"
            )}
          >
            <ChevronLeft
              className={cn(
                "w-4 h-4 transition-transform duration-300",
                collapsed && "rotate-180"
              )}
            />
          </button>

          {/* Logo Header */}
          <div className="h-[100px] min-h-[100px] flex items-center px-5">
            <Link href="/" className="flex items-center gap-3">
              {/* Logo 图标 */}
              <div className="w-9 h-9 min-w-[36px] flex items-center justify-center rounded-lg bg-[var(--sidebar-accent)] text-white font-bold text-xl">
                A
              </div>
              {/* Logo 文字 */}
              <h5
                className={cn(
                  "text-xl font-semibold text-[var(--sidebar-text-hover)] whitespace-nowrap overflow-hidden",
                  "sidebar-content-transition",
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                )}
              >
                Acme Inc
              </h5>
            </Link>
          </div>

          {/* 导航链接区域 - 允许弹出菜单溢出 */}
          <div className="flex-1 overflow-y-auto overflow-x-visible sidebar-scroll py-2">
            <NavLinks collapsed={collapsed} />
          </div>

          {/* Footer 区域 */}
          <div
            className={cn(
              "px-5 py-4 sidebar-content-transition",
              collapsed ? "opacity-0 hidden" : "opacity-100"
            )}
          >
            <div className="bg-[var(--sidebar-footer-bg)] rounded-lg p-4 text-center text-xs">
              <div className="text-[var(--sidebar-text-hover)] mb-2">
                Pro Dashboard
              </div>
              <div className="text-[var(--sidebar-text)]">Built with Next.js</div>
            </div>
          </div>

          {/* 登出按钮 */}
          <div className="px-5 py-4 border-t border-[rgba(83,93,125,0.3)]">
            <form action={logout}>
              <button
                type="submit"
                className={cn(
                  "flex w-full h-12 items-center gap-3 rounded-md px-5 icon-swing",
                  "text-[var(--sidebar-text)] transition-colors",
                  "hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-bg-secondary)]",
                  collapsed && "justify-center px-0"
                )}
              >
                <LogOut className="menu-icon h-5 w-5 flex-shrink-0" />
                <span
                  className={cn(
                    "text-sm whitespace-nowrap sidebar-content-transition",
                    collapsed ? "opacity-0 w-0 hidden" : "opacity-100"
                  )}
                >
                  登出
                </span>
              </button>
            </form>
          </div>
        </aside>
      </div>
    </SidebarContext.Provider>
  );
}
