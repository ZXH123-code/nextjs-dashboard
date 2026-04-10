import Link from "next/link";
import {
  getCrmAuth,
  getLeadsForWeeklyProgress,
  getWeeklyProgressStats,
  type WeeklyProgressFollowUpRow,
} from "@/app/lib/crm";
import { isWeeklyProgressDepartment } from "@/app/lib/crm-weekly-progress-config";
import { CatchUpLeadsSheet } from "./CatchUpLeadsSheet";
import { WeeklyProgressTable } from "./WeeklyProgressTable";
import { lusitana } from "@/app/ui/fonts";
import { Card } from "@/app/ui/dashboard/cards";

export default async function WeeklyProgressPage() {
  const auth = await getCrmAuth();
  if (!auth) return null;

  if (!isWeeklyProgressDepartment(auth.departmentId)) {
    return (
      <main className="p-6 md:p-8">
        <h1 className={`${lusitana.className} text-xl md:text-2xl mb-4`}>本周跟进</h1>
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
      getLeadsForWeeklyProgress(auth, { weekOnly: true }),
      getWeeklyProgressStats(auth),
    ]);
    items = res.items;
    followUpsThisWeekByLeadId = res.followUpsThisWeekByLeadId;
    stats = s;
  } catch (e) {
    console.error("获取本周跟进失败:", e);
  }

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className={`${lusitana.className} text-xl md:text-2xl`}>本周跟进</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            主列表仅展示本周有跟进的线索。若某条本周尚未记录跟进，可点「补本周跟进」在侧栏搜索并写最简跟进，保存后即会出现在下方列表。周范围：自然周（周一至周日，本地时区）。
          </p>
        </div>
        <div className="shrink-0">
          <CatchUpLeadsSheet />
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card title="线索总数" value={stats.leadTotal} type="leads" />
        <Card title="本周有跟进的线索" value={stats.leadsWithFollowUpThisWeek} type="opportunities" />
        <Card title="本周跟进条数" value={stats.followUpsThisWeekCount} type="total" />
      </div>

      <WeeklyProgressTable items={items} followUpsThisWeekByLeadId={followUpsThisWeekByLeadId} />
    </main>
  );
}
