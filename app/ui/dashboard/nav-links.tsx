"use client";
import {
  LayoutDashboard,
  Package,
  Lightbulb,
  TrendingUp,
  Shield,
  Settings,
  Box,
  BarChart3,
  PackageSearch,
  Undo2,
  Sparkles,
  LineChart,
  Target,
  Users,
  ShieldCheck,
  Sliders,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

interface SubLink {
  name: string;
  href: string;
  badge?: { text: string; type: "primary" | "secondary" };
  disabled?: boolean;
}

interface NavLink {
  name: string;
  href?: string;
  icon: any;
  badge?: { text: string; type: "primary" | "secondary" };
  subLinks?: SubLink[];
}

interface NavLinkGroup {
  header?: string;
  links: NavLink[];
}

// 导航链接分组
const navGroups: NavLinkGroup[] = [
  {
    header: "核心看板",
    links: [
      {
        name: "驾驶舱",
        href: "/dashboard",
        icon: LayoutDashboard,
        badge: { text: "Hot", type: "primary" },
      },
    ],
  },
  {
    header: "AI 智脑中台",
    links: [
      {
        name: "履约与物流大脑",
        icon: Package,
        subLinks: [
          { name: "3D 智能拼柜计算", href: "/dashboard/fulfillment/container-loading" },
          { name: "虚拟库存与广告协同", href: "/dashboard/fulfillment/inventory-ads" },
          { name: "退货预测与管理", href: "/dashboard/fulfillment/return-prediction" },
        ],
      },
      {
        name: "选品与产品智脑",
        icon: Lightbulb,
        subLinks: [
          { name: "新品开发与设计助手", href: "/dashboard/product-intelligence/new-product-designer" },
          { name: "产品线布局优化", href: "/dashboard/product-intelligence/product-line" },
        ],
      },
      {
        name: "营销与定价引擎",
        icon: TrendingUp,
        subLinks: [
          { name: "动态定价系统", href: "/dashboard/marketing-pricing/dynamic-pricing" },
          { name: "智能推荐配置", href: "/dashboard/marketing-pricing/recommendation" },
          { name: "渠道与达人匹配", href: "/dashboard/marketing-pricing/influencer-matching" },
        ],
      },
      {
        name: "服务与风控中台",
        icon: Shield,
        subLinks: [
          { name: "智能协商退款", href: "/dashboard/service-risk/refund-negotiation" },
        ],
      },
    ],
  },
  {
    header: "系统配置",
    links: [
      {
        name: "系统管理",
        icon: Settings,
        subLinks: [
          { name: "算法参数配置", href: "/dashboard/system/algorithm-config" },
          { name: "模型训练监控", href: "/dashboard/system/model-monitoring" },
        ],
      },
    ],
  },
];

// Badge 组件
function Badge({ text, type }: { text: string; type: "primary" | "secondary" }) {
  return (
    <span
      className={cn(
        "px-1.5 py-0.5 text-[10px] font-bold rounded text-white",
        type === "primary" && "bg-[var(--sidebar-badge-primary)]",
        type === "secondary" && "bg-[var(--sidebar-badge-secondary)]"
      )}
    >
      {text}
    </span>
  );
}

// 弹出子菜单组件 - 用于折叠状态
function PopoverSubMenu({
  link,
  isVisible,
  onClose,
  triggerRef,
}: {
  link: NavLink;
  isVisible: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0 });

  // 计算位置
  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({ top: rect.top });
    }
  }, [isVisible, triggerRef]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isVisible, onClose, triggerRef]);

  if (!isVisible || !link.subLinks) return null;

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-[200] ml-1 min-w-[200px] rounded-md shadow-xl",
        "bg-[var(--sidebar-bg)] border border-[rgba(83,93,125,0.3)]",
        "animate-in fade-in-0 zoom-in-95 slide-in-from-left-2",
        "duration-200"
      )}
      style={{
        left: "80px",
        top: `${position.top}px`,
      }}
    >
      {/* 标题 */}
      <div className="px-4 py-3 border-b border-[rgba(83,93,125,0.3)]">
        <span className="text-sm font-medium text-[var(--sidebar-text-hover)]">
          {link.name}
        </span>
      </div>
      {/* 子菜单列表 */}
      <ul className="py-2">
        {link.subLinks.map((subLink) => {
          const isActive = pathname === subLink.href;
          return (
            <li key={subLink.name}>
              <Link
                href={subLink.disabled ? "#" : subLink.href}
                onClick={(e) => {
                  if (subLink.disabled) {
                    e.preventDefault();
                    alert("功能开发中，敬请期待");
                  } else {
                    onClose();
                  }
                }}
                className={cn(
                  "flex items-center px-4 py-2.5 text-sm transition-colors",
                  subLink.disabled
                    ? "text-[var(--sidebar-text)]/50 cursor-not-allowed"
                    : "text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-bg-secondary)]",
                  isActive && "text-[var(--sidebar-text-hover)] bg-[var(--sidebar-bg-secondary)]"
                )}
              >
                <span className="truncate">{subLink.name}</span>
                {subLink.badge && (
                  <span className="ml-auto">
                    <Badge text={subLink.badge.text} type={subLink.badge.type} />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// 菜单项组件
function NavLinkItem({
  link,
  collapsed,
}: {
  link: NavLink;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const LinkIcon = link.icon;

  // 带子菜单的项目
  if (link.subLinks) {
    const hasActiveChild = link.subLinks.some((sub) => pathname === sub.href);

    const handleClick = () => {
      if (collapsed) {
        // 折叠状态：显示弹出菜单
        setShowPopover(!showPopover);
      } else {
        // 展开状态：展开/收起子菜单
        setIsOpen(!isOpen);
      }
    };

    return (
      <div className="menu-item relative">
        <button
          ref={buttonRef}
          onClick={handleClick}
          className={cn(
            "flex w-full h-[50px] items-center px-5 icon-swing relative",
            "text-[var(--sidebar-text)] transition-colors",
            "hover:text-[var(--sidebar-text-hover)]",
            (hasActiveChild || isOpen || showPopover) && "text-[var(--sidebar-text-hover)]"
          )}
        >
          {/* 图标 */}
          <span
            className={cn(
              "menu-icon w-[35px] h-[35px] min-w-[35px] flex items-center justify-center",
              "text-lg rounded transition-colors",
              "bg-[var(--sidebar-bg-secondary)]",
              !collapsed && "mr-2.5"
            )}
          >
            <LinkIcon className="w-5 h-5" />
          </span>

          {/* 标题 */}
          <span
            className={cn(
              "text-sm text-left truncate sidebar-content-transition",
              collapsed ? "hidden" : "flex-1"
            )}
          >
            {link.name}
          </span>

          {/* Badge */}
          {link.badge && !collapsed && (
            <span className="mx-1">
              <Badge text={link.badge.text} type={link.badge.type} />
            </span>
          )}

          {/* 展开箭头 - 仅展开状态显示 */}
          {!collapsed && (
            <span
              className={cn(
                "w-1.5 h-1.5 border-r-2 border-b-2 border-current",
                "transition-transform duration-300",
                isOpen ? "rotate-45" : "-rotate-45"
              )}
            />
          )}

          {/* 折叠时的指示点 */}
          {collapsed && (
            <span
              className={cn(
                "absolute right-2.5 w-1.5 h-1.5 rounded-full",
                "bg-current transition-colors",
                (hasActiveChild || showPopover) && "bg-[var(--sidebar-text-hover)]"
              )}
            />
          )}
        </button>

        {/* 展开状态的子菜单列表 */}
        {isOpen && !collapsed && (
          <div className="pl-5 bg-[var(--sidebar-bg-secondary)] submenu-enter overflow-hidden">
            <ul className="py-1">
              {link.subLinks.map((subLink) => {
                const isActive = pathname === subLink.href;
                return (
                  <li key={subLink.name}>
                    <Link
                      href={subLink.disabled ? "#" : subLink.href}
                      onClick={(e) => {
                        if (subLink.disabled) {
                          e.preventDefault();
                          alert("功能开发中，敬请期待");
                        }
                      }}
                      className={cn(
                        "flex h-[45px] items-center px-5 text-sm transition-colors",
                        subLink.disabled
                          ? "text-[var(--sidebar-text)]/50 cursor-not-allowed"
                          : "text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)]",
                        isActive && "text-[var(--sidebar-text-hover)]"
                      )}
                    >
                      <span className="truncate">{subLink.name}</span>
                      {subLink.badge && (
                        <span className="ml-2">
                          <Badge text={subLink.badge.text} type={subLink.badge.type} />
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 折叠状态的弹出子菜单 */}
        {collapsed && (
          <PopoverSubMenu
            link={link}
            isVisible={showPopover}
            onClose={() => setShowPopover(false)}
            triggerRef={buttonRef}
          />
        )}
      </div>
    );
  }

  // 普通链接
  const isActive = pathname === link.href;
  return (
    <div className="menu-item">
      <Link
        href={link.href!}
        className={cn(
          "flex h-[50px] items-center px-5 icon-swing",
          "text-[var(--sidebar-text)] transition-colors",
          "hover:text-[var(--sidebar-text-hover)]",
          isActive && "text-[var(--sidebar-text-hover)]"
        )}
      >
        {/* 图标 */}
        <span
          className={cn(
            "menu-icon w-[35px] h-[35px] min-w-[35px] flex items-center justify-center",
            "text-lg rounded transition-colors",
            "bg-[var(--sidebar-bg-secondary)]",
            isActive && "text-[var(--sidebar-text-hover)]",
            !collapsed && "mr-2.5"
          )}
        >
          <LinkIcon className="w-5 h-5" />
        </span>

        {/* 标题 */}
        {!collapsed && (
          <span className="flex-1 text-sm truncate">
            {link.name}
          </span>
        )}

        {/* Badge */}
        {link.badge && !collapsed && (
          <span className="ml-auto">
            <Badge text={link.badge.text} type={link.badge.type} />
          </span>
        )}
      </Link>
    </div>
  );
}

// 导出主组件
export default function NavLinks({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <nav className="menu">
      <ul className="list-none p-0 m-0">
        {navGroups.map((group, groupIndex) => (
          <li key={groupIndex}>
            {/* 分组标题 */}
            {group.header && (
              <div
                className={cn(
                  "px-6 py-2.5 text-[0.7rem] font-semibold tracking-[2px] opacity-50",
                  "transition-opacity duration-300",
                  collapsed && "opacity-0",
                  groupIndex > 0 && "pt-5"
                )}
              >
                {group.header}
              </div>
            )}

            {/* 分组内的链接 */}
            {group.links.map((link) => (
              <NavLinkItem key={link.name} link={link} collapsed={collapsed} />
            ))}
          </li>
        ))}
      </ul>
    </nav>
  );
}
