"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Clock3, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FilterMode = "week" | "range";

function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function WeeklyProgressFilters({
  initialMode,
  initialWeek,
  initialStart,
  initialEnd,
}: {
  initialMode: FilterMode;
  initialWeek: string;
  initialStart: string;
  initialEnd: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<FilterMode>(initialMode);
  const [week, setWeek] = useState(initialWeek);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);

  const rangeInvalid = useMemo(() => {
    if (mode !== "range") return false;
    if (!start || !end) return true;
    if (!isValidDateInput(start) || !isValidDateInput(end)) return true;
    return start > end;
  }, [mode, start, end]);

  const apply = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", mode);

    if (mode === "week") {
      if (week) params.set("week", week);
      else params.delete("week");
      params.delete("start");
      params.delete("end");
    } else {
      params.delete("week");
      params.set("start", start);
      params.set("end", end);
    }

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const reset = () => {
    router.replace(pathname, { scroll: false });
  };

  return (
    <section className="rounded-xl border border-border/80 bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
        <Filter className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        时间筛选
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select value={mode} onValueChange={(v) => setMode(v as FilterMode)}>
          <SelectTrigger className="h-9 w-[min(100%,160px)] shrink-0" aria-label="筛选方式">
            <SelectValue placeholder="筛选方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">按周筛选</SelectItem>
            <SelectItem value="range">按时间段筛选</SelectItem>
          </SelectContent>
        </Select>

        {mode === "week" ? (
          <div className="relative min-w-0 w-[min(100%,220px)] shrink-0">
            <CalendarDays
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="week"
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="h-9 pl-9"
              aria-label="选择周"
            />
          </div>
        ) : (
          <>
            <div className="relative w-[min(100%,150px)] shrink-0">
              <Clock3
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="h-9 pl-9"
                aria-label="开始日期"
              />
            </div>
            <div className="relative w-[min(100%,150px)] shrink-0">
              <Clock3
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="h-9 pl-9"
                aria-label="结束日期"
              />
            </div>
          </>
        )}

        <Button type="button" size="sm" className="shrink-0" onClick={apply} disabled={rangeInvalid}>
          应用筛选
        </Button>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={reset}>
          恢复默认（本周）
        </Button>

        {rangeInvalid ? (
          <p className="basis-full text-xs text-destructive">
            按时间段筛选时需同时填写开始和结束日期，且开始不能晚于结束。
          </p>
        ) : null}
      </div>
    </section>
  );
}
