import {
  Bot,
  Calendar,
  ClipboardList,
  Clock,
  Forward,
  Hash,
  MessageSquare,
  Pencil,
  Sparkles,
  Star,
  User,
  UserRound,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { QuickLeadFollowUpForm } from "./QuickLeadFollowUpForm";
import type { WeeklyProgressFollowUpRow, WeeklyProgressLeadItem } from "@/app/lib/crm";
import {
  getTierVisual,
  INDUSTRY_COLUMN_LABEL,
  LATEST_SECTION_MAX_HEIGHT_PX,
  TIER_COLUMN_LABEL,
  WEEK_TIMELINE_ITEM_MAX_HEIGHT_PX,
} from "./view-config";
import { cn } from "@/lib/utils";

/** 与本地日历日一致：0=周日 … 6=周六 */
const WEEKDAY_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;

function formatWeekdayZh(d: Date): string {
  return WEEKDAY_ZH[new Date(d).getDay()];
}

function formatDate(d: Date): string {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateTime(d: Date): string {
  const x = new Date(d);
  const date = formatDate(x);
  const hh = String(x.getHours()).padStart(2, "0");
  const mm = String(x.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
}

function followBody(f: { summary: string | null; content: string }): string {
  const raw = (f.summary?.trim() || f.content || "").replace(/\s+/g, " ");
  return raw || "（无文字）";
}

/** 转化阶段：已挂客户 > 仅有商机 > 仍在线索 */
function leadStagePill(lead: WeeklyProgressLeadItem): { label: string; className: string } {
  if (lead.opportunity?.customer?.id) {
    return {
      label: "客户",
      className:
        "border-violet-500/30 bg-violet-500/[0.07] text-violet-950 dark:border-violet-500/25 dark:bg-violet-950/35 dark:text-violet-100",
    };
  }
  if (lead.opportunity) {
    return {
      label: "商机",
      className:
        "border-primary/28 bg-primary/[0.07] text-foreground dark:border-primary/32 dark:bg-primary/12",
    };
  }
  return {
    label: "线索",
    className: "border-border bg-muted/50 text-muted-foreground",
  };
}

type LatestFollowUp = WeeklyProgressLeadItem["followUps"][number];

type LucideIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function LatestFieldRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <p className="flex gap-2.5 text-sm leading-relaxed text-foreground/95">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="text-muted-foreground">{label}</span>
        {children}
      </span>
    </p>
  );
}

function LatestFollowUpBlock({ fu }: { fu: LatestFollowUp }) {
  const authorName = fu.followUpBy?.name?.trim() || "—";
  const contentTrim = fu.content?.trim() ?? "";

  const edited =
    fu.updatedAt &&
    new Date(fu.updatedAt).getTime() !== new Date(fu.createdAt).getTime();

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">最新跟进</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            {formatDateTime(fu.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            跟进日 {formatWeekdayZh(new Date(fu.followDate))}{" "}
            <span className="tabular-nums opacity-80">{formatDate(new Date(fu.followDate))}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <User className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            {authorName}
          </span>
          {fu.isSystemGenerated ? (
            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
              <Bot className="h-3.5 w-3.5 opacity-70" aria-hidden />
              系统生成
            </span>
          ) : null}
          {edited ? (
            <span className="inline-flex items-center gap-0.5 tabular-nums">
              <Pencil className="h-3.5 w-3.5 opacity-70" aria-hidden />
              已编辑 {formatDateTime(fu.updatedAt!)}
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="space-y-3 overflow-y-auto border-t border-border/50 pt-3 text-sm"
        style={{ maxHeight: LATEST_SECTION_MAX_HEIGHT_PX }}
      >
        {fu.summary?.trim() ? (
          <LatestFieldRow icon={Sparkles} label="进展 · ">
            <span className="whitespace-pre-wrap break-words">{fu.summary.trim()}</span>
          </LatestFieldRow>
        ) : null}
        <LatestFieldRow icon={MessageSquare} label="内容 · ">
          <span className="mt-0.5 block whitespace-pre-wrap break-words">
            {contentTrim || "（无）"}
          </span>
        </LatestFieldRow>
        {fu.contactPerson?.trim() ? (
          <LatestFieldRow icon={UserRound} label="对象 · ">
            {fu.contactPerson.trim()}
          </LatestFieldRow>
        ) : null}
        {fu.nextStep?.trim() ? (
          <LatestFieldRow icon={Forward} label="下一步 · ">
            <span className="whitespace-pre-wrap break-words">{fu.nextStep.trim()}</span>
          </LatestFieldRow>
        ) : null}
        {fu.customerNeeds?.trim() ? (
          <LatestFieldRow icon={ClipboardList} label="需求 · ">
            <span className="whitespace-pre-wrap break-words">{fu.customerNeeds.trim()}</span>
          </LatestFieldRow>
        ) : null}
        {fu.status?.trim() ? (
          <LatestFieldRow icon={Hash} label="状态 · ">
            {fu.status.trim()}
          </LatestFieldRow>
        ) : null}
      </div>
    </>
  );
}

type Props = {
  items: WeeklyProgressLeadItem[];
  followUpsThisWeekByLeadId: Record<string, WeeklyProgressFollowUpRow[]>;
  periodLabel: string;
};

export function WeeklyProgressTable({ items, followUpsThisWeekByLeadId, periodLabel }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">当前筛选下暂无线索</p>
        <p className="mt-2 text-sm text-muted-foreground">
          可点击页面上方「搜索线索写跟进」，在可查线索中搜索并写一条最简跟进；保存后若落在当前时段内，会出现在此列表。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {items.map((lead) => {
        const oppName = lead.opportunity?.name?.trim();
        const tier = lead.customerTier;
        const assigneeLabel = lead.assignees.length
          ? lead.assignees.map((a) => a.user.name).join("、")
          : "未指定";
        const visual = getTierVisual(tier);
        const latestFu = lead.followUps[0];
        const weekList = followUpsThisWeekByLeadId[lead.id] ?? [];
        const stage = leadStagePill(lead);

        return (
          <article
            key={lead.id}
            className={cn(
              "flex overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-shadow duration-200 hover:shadow-md",
              visual.surface
            )}
          >
            <div
              className={cn("w-1.5 shrink-0 self-stretch min-h-[120px] rounded-l-[inherit]", visual.bar)}
              aria-hidden
            />

            <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight",
                        visual.badge
                      )}
                      title={tier ?? TIER_COLUMN_LABEL}
                    >
                      {TIER_COLUMN_LABEL}
                      {tier?.trim() ? ` · ${tier.trim()}` : " · 未设"}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        stage.className
                      )}
                    >
                      {stage.label}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-border bg-background/90 px-2.5 py-0.5 text-xs font-medium text-foreground/90">
                      {lead.status}
                    </span>
                    {lead.isKeyFocus ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-600" aria-hidden />
                        重点关注
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold leading-snug tracking-tight text-foreground sm:text-xl">
                      {lead.customerName?.trim() || "—"}
                    </h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {oppName ? (
                        <>
                          <span className="text-foreground/75">项目/商机</span>
                          <span className="text-foreground/90"> · {oppName}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground/90">暂无关联商机</span>
                      )}
                      {lead.nickname?.trim() ? (
                        <span className="text-muted-foreground"> · 简称 {lead.nickname.trim()}</span>
                      ) : null}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {lead.city?.trim() ? (
                        <span>
                          城市 <span className="text-foreground/80">{lead.city.trim()}</span>
                        </span>
                      ) : null}
                      <span>
                        {INDUSTRY_COLUMN_LABEL}{" "}
                        <span className="text-foreground/80">{lead.industry?.trim() || "—"}</span>
                      </span>
                      <span>
                        负责人 <span className="text-foreground/80">{assigneeLabel}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-full shrink-0 lg:w-[min(100%,380px)] xl:w-[420px]">
                  <QuickLeadFollowUpForm leadId={lead.id} />
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <section className={cn("rounded-xl border p-4 sm:p-5", visual.latestStripe)}>
                  {latestFu ? (
                    <LatestFollowUpBlock fu={latestFu} />
                  ) : (
                    <>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">
                        最新跟进
                      </h3>
                      <p className="text-sm italic text-muted-foreground">暂无跟进记录</p>
                    </>
                  )}
                </section>

                <section className="rounded-xl border border-border/90 bg-muted/25 p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">
                      {periodLabel}全部跟进
                    </h3>
                    <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground ring-1 ring-border">
                      {weekList.length} 条
                    </span>
                  </div>

                  {weekList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{periodLabel}暂无跟进记录。</p>
                  ) : (
                    <ul
                      className="relative max-h-[min(320px,50vh)] space-y-0 overflow-y-auto pr-1"
                      aria-label={`${periodLabel}跟进时间线`}
                    >
                      <li
                        className="absolute bottom-1 left-[7px] top-2 w-px bg-border"
                        aria-hidden
                      />
                      {weekList.map((row) => {
                        const body = followBody(row);
                        return (
                          <li key={row.id} className="relative flex gap-3 pb-4 pl-5 last:pb-0">
                            <span
                              className="absolute left-[2.5px] top-1.5 z-[1] h-2.5 w-2.5 shrink-0 rounded-full border-2 border-background bg-primary shadow-sm ring-1 ring-primary/30"
                              aria-hidden
                            />
                            <div className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background/95 p-3 shadow-sm">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                <span className="inline-flex items-center gap-0.5 font-medium text-foreground/80">
                                  <Clock className="h-3 w-3 opacity-60" aria-hidden />
                                  {formatDateTime(row.createdAt)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                                  <span className="text-foreground/85">跟进日 {formatWeekdayZh(new Date(row.followDate))}</span>
                                  <span className="tabular-nums opacity-65">{formatDate(new Date(row.followDate))}</span>
                                </span>
                                <span className="inline-flex items-center gap-0.5">
                                  <User className="h-3 w-3 opacity-60" aria-hidden />
                                  {row.authorName}
                                </span>
                              </div>
                              <div
                                className="mt-2 overflow-y-auto text-sm leading-relaxed text-foreground/90"
                                style={{ maxHeight: WEEK_TIMELINE_ITEM_MAX_HEIGHT_PX }}
                              >
                                <p className="whitespace-pre-wrap break-words">{body}</p>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
