import Link from "next/link";
import {
  getCrmAuth,
  getLeadsForWeeklyProgress,
  getWeeklyProgressStats,
  type WeeklyProgressTimeWindow,
  type WeeklyProgressFollowUpRow,
} from "@/app/lib/crm";
import { isWeeklyProgressDepartment } from "@/app/lib/crm-weekly-progress-config";
import { CatchUpLeadsSheet } from "./CatchUpLeadsSheet";
import { WeeklyProgressTable } from "./WeeklyProgressTable";
import { WeeklyProgressFilters } from "./WeeklyProgressFilters";
import { lusitana } from "@/app/ui/fonts";
import { Card } from "@/app/ui/dashboard/cards";

type SearchParams = {
  mode?: string | string[];
  week?: string | string[];
  start?: string | string[];
  end?: string | string[];
};

function getSingleParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

const CHINA_TZ = "Asia/Shanghai" as const;

function formatChinaDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHINA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getChinaYmdParts(date: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHINA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  return { y, m, d };
}

function chinaMidnightToUtcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, -8, 0, 0, 0));
}

function getChinaWeekdayIndex(date: Date): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const w = new Intl.DateTimeFormat("en-US", { timeZone: CHINA_TZ, weekday: "short" }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const idx = map[w];
  return (idx ?? 0) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

function getCurrentWeekStart(): Date {
  const now = new Date();
  const { y, m, d } = getChinaYmdParts(now);
  const dow = getChinaWeekdayIndex(now);
  const offsetMonday = dow === 0 ? -6 : 1 - dow;
  const todayChinaMidnightUtc = chinaMidnightToUtcDate(y, m, d);
  return addDays(todayChinaMidnightUtc, offsetMonday);
}

function getIsoWeekValue(date: Date): string {
  const tmp = new Date(date);
  tmp.setHours(0, 0, 0, 0);
  const day = (tmp.getDay() + 6) % 7;
  tmp.setDate(tmp.getDate() - day + 3);

  const year = tmp.getFullYear();
  const firstThursday = new Date(year, 0, 4, 0, 0, 0, 0);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);

  const week = 1 + Math.round((tmp.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function parseWeekValue(weekValue: string): WeeklyProgressTimeWindow | null {
  const m = /^(\d{4})-W(0[1-9]|[1-4]\d|5[0-3])$/.exec(weekValue);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = new Date(year, 0, 4, 0, 0, 0, 0);
  const jan4IsoDay = (jan4.getDay() + 6) % 7;
  const week1Monday = new Date(year, 0, 4 - jan4IsoDay, 0, 0, 0, 0);
  const start = addDays(week1Monday, (week - 1) * 7);
  if (getIsoWeekValue(start) !== weekValue) return null;
  return { start, endExclusive: addDays(start, 7) };
}

function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  // 统一以中国时区当天 00:00（转成 UTC 时间点）作为边界，避免服务器时区影响
  const date = chinaMidnightToUtcDate(y, m, d);
  // 校验输入日期本身有效性
  const check = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return date;
}

function resolveTimeFilter(params: SearchParams): {
  mode: "week" | "range";
  weekValue: string;
  startValue: string;
  endValue: string;
  window: WeeklyProgressTimeWindow;
  summaryLabel: string;
} {
  const modeRaw = getSingleParam(params.mode);
  const weekRaw = getSingleParam(params.week)?.trim();
  const startRaw = getSingleParam(params.start)?.trim() ?? "";
  const endRaw = getSingleParam(params.end)?.trim() ?? "";

  const currentWeekStart = getCurrentWeekStart();
  const defaultWeekValue = getIsoWeekValue(currentWeekStart);
  const fallbackWindow: WeeklyProgressTimeWindow = {
    start: currentWeekStart,
    endExclusive: addDays(currentWeekStart, 7),
  };

  if (modeRaw === "range") {
    const start = parseDateInput(startRaw);
    const end = parseDateInput(endRaw);
    if (start && end && start <= end) {
      return {
        mode: "range",
        weekValue: weekRaw ?? defaultWeekValue,
        startValue: startRaw,
        endValue: endRaw,
        window: { start, endExclusive: addDays(end, 1) },
        summaryLabel: `${startRaw} 至 ${endRaw}`,
      };
    }
  }

  const weekValue = weekRaw ?? defaultWeekValue;
  const parsedWeek = parseWeekValue(weekValue) ?? fallbackWindow;
  return {
    mode: "week",
    weekValue: parseWeekValue(weekValue) ? weekValue : defaultWeekValue,
    startValue: startRaw,
    endValue: endRaw,
    window: parsedWeek,
    summaryLabel: `${formatChinaDate(parsedWeek.start)} 至 ${formatChinaDate(addDays(parsedWeek.endExclusive, -1))}`,
  };
}

export default async function WeeklyProgressPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const timeFilter = resolveTimeFilter(params);

  const auth = await getCrmAuth();
  if (!auth) return null;

  if (!isWeeklyProgressDepartment(auth.departmentId)) {
    return (
      <main className="p-6 md:p-8">
        <h1 className={`${lusitana.className} text-xl md:text-2xl mb-4`}>跟进汇报</h1>
        <p className="text-muted-foreground mb-4">当前账号所属部门未开通此汇报视图。</p>
        <Link href="/dashboard" className="text-primary underline-offset-4 hover:underline">
          返回驾驶舱
        </Link>
      </main>
    );
  }

  let items: Awaited<ReturnType<typeof getLeadsForWeeklyProgress>>["items"] = [];
  let followUpsThisWeekByLeadId: Record<string, WeeklyProgressFollowUpRow[]> = {};
  let stats = { leadTotal: 0, leadsWithFollowUpThisWeek: 0, followUpsThisWeekCount: 0 };
  try {
    const [res, s] = await Promise.all([
      getLeadsForWeeklyProgress(auth, { weekOnly: true, window: timeFilter.window }),
      getWeeklyProgressStats(auth, timeFilter.window),
    ]);
    items = res.items;
    followUpsThisWeekByLeadId = res.followUpsThisWeekByLeadId;
    stats = s;
  } catch (e) {
    console.error("获取跟进汇报失败:", e);
  }

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className={`${lusitana.className} text-xl md:text-2xl`}>跟进汇报</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            当前范围：{timeFilter.summaryLabel}。主列表仅展示该时段内有跟进的线索。若尚未记录，可点「搜索线索写跟进」，在可查线索中搜索目标并写一条最简跟进；保存后若落在当前时段内，会出现在下方列表。
          </p>
        </div>
        <div className="shrink-0">
          <CatchUpLeadsSheet />
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card title="线索合计" value={stats.leadTotal} type="leads" />
        <Card title="有跟进线索" value={stats.leadsWithFollowUpThisWeek} type="opportunities" />
        <Card title="跟进条数" value={stats.followUpsThisWeekCount} type="total" />
      </div>

      <div className="mb-6">
        <WeeklyProgressFilters
          initialMode={timeFilter.mode}
          initialWeek={timeFilter.weekValue}
          initialStart={timeFilter.startValue}
          initialEnd={timeFilter.endValue}
        />
      </div>

      <WeeklyProgressTable
        items={items}
        followUpsThisWeekByLeadId={followUpsThisWeekByLeadId}
        periodLabel={timeFilter.mode === "week" ? "该周" : "该时间段"}
      />
    </main>
  );
}
