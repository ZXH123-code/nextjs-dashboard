"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PaginationProps = {
  /** 基础路径，如 /dashboard/crm/leads */
  basePath: string;
  /** 当前页码（1-based） */
  currentPage: number;
  /** 总页数 */
  totalPages: number;
  /** 总记录数 */
  total: number;
  /** 每页条数 */
  pageSize: number;
  /** 需要保留的 query 参数，如 { highlight: "xxx", filter: "..." } */
  preserveParams?: Record<string, string | undefined>;
  /** 是否显示每页条数选择器 */
  showPageSizeSelector?: boolean;
};

function buildHref(basePath: string, page: number, pageSize: number, preserve?: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (pageSize !== 20) params.set("pageSize", String(pageSize));
  if (preserve) {
    for (const [k, v] of Object.entries(preserve)) {
      if (v) params.set(k, v);
    }
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({
  basePath,
  currentPage,
  totalPages,
  total,
  pageSize,
  preserveParams,
  showPageSizeSelector,
}: PaginationProps) {
  const router = useRouter();
  if (total === 0) return null;

  const prevHref = currentPage > 1 ? buildHref(basePath, currentPage - 1, pageSize, preserveParams) : null;
  const nextHref = currentPage < totalPages ? buildHref(basePath, currentPage + 1, pageSize, preserveParams) : null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  const pageNumbers: (number | "ellipsis")[] = [];
  const showAround = 2;
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= showAround) {
      const last = pageNumbers[pageNumbers.length - 1];
      if (last !== undefined && last !== "ellipsis" && typeof last === "number" && p - last > 1) {
        pageNumbers.push("ellipsis");
      }
      pageNumbers.push(p);
    }
  }

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-4 border-t bg-card px-4 py-3"
      aria-label="分页"
    >
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground">
          共 {total} 条，当前第 {start}–{end} 条
        </p>
        {showPageSizeSelector && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">每页</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                const href = buildHref(basePath, 1, Number(v), preserveParams);
                router.replace(href);
              }}
            >
              <SelectTrigger className="h-8 w-[88px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} 条
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {prevHref ? (
          <Link
            href={prevHref}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            aria-label="上一页"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span
            className="inline-flex h-8 min-w-8 cursor-not-allowed items-center justify-center rounded-md border border-input bg-muted/50 text-muted-foreground"
            aria-disabled="true"
          >
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}

        <div className="mx-1 flex items-center gap-0.5">
          {pageNumbers.map((p, i) =>
            p === "ellipsis" ? (
              <span key={`e-${i}`} className="px-1.5 text-muted-foreground">
                …
              </span>
            ) : (
              p === currentPage ? (
                <span
                  key={p}
                  className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-primary bg-primary text-primary-foreground text-sm font-medium"
                  aria-current="page"
                >
                  {p}
                </span>
              ) : (
                <Link
                  key={p}
                  href={buildHref(basePath, p, pageSize, preserveParams)}
                  className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  {p}
                </Link>
              )
            )
          )}
        </div>

        {nextHref ? (
          <Link
            href={nextHref}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            aria-label="下一页"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span
            className="inline-flex h-8 min-w-8 cursor-not-allowed items-center justify-center rounded-md border border-input bg-muted/50 text-muted-foreground"
            aria-disabled="true"
          >
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
