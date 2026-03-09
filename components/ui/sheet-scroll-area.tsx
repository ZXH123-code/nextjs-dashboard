"use client";

import { cn } from "@/lib/utils";

/**
 * 抽屉/详情滑层内的滚动区域
 * 使用 sheet-scroll 样式（细滚动条、圆角、跟随主题），底部留白避免内容被遮挡
 */
export function SheetScrollArea({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-4 flex-1 overflow-y-auto space-y-4 text-left sheet-scroll pb-8",
        className
      )}
    >
      {children}
    </div>
  );
}
