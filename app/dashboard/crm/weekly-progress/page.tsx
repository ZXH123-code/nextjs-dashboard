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

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getCurrentWeekStart(): Date {
  const now = new Date();
  const dow = now.getDay();
  const offsetMonday = dow === 0 ? -6 : 1 - dow;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetMonday, 0, 0, 0, 0);
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
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
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
    summaryLabel: `${formatDate(parsedWeek.start)} 至 ${formatDate(addDays(parsedWeek.endExclusive, -1))}`,
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
