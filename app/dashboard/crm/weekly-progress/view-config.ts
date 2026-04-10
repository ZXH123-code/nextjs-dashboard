/** 最新跟进区块：正文展示上限（超出可滚动） */
export const LATEST_SECTION_MAX_HEIGHT_PX = 360;

/** 本周时间线：单条内容区域最大高度，超出滚动（完整展示不做截断） */
export const WEEK_TIMELINE_ITEM_MAX_HEIGHT_PX = 160;

/** 本页将 industry 字段展示为「业态」 */
export const INDUSTRY_COLUMN_LABEL = "业态";

/** 本页将 customerTier 展示为「跟进评级」 */
export const TIER_COLUMN_LABEL = "跟进评级";

type TierVisual = {
  /** 左侧竖条（完整 Tailwind class） */
  bar: string;
  /** 评级徽章 */
  badge: string;
  /** 卡片极淡底纹 */
  surface: string;
  /** 「最新跟进」标题条 */
  latestStripe: string;
};

function resolveTierKey(tier: string | null | undefined): "s" | "a" | "b" | "c" | "none" {
  if (!tier?.trim()) return "none";
  const t = tier.trim().toUpperCase();
  if (t.startsWith("S") || tier.includes("紧急") || tier.includes("重点")) return "s";
  if (t.startsWith("A") || tier.includes("高")) return "a";
  if (t.startsWith("B") || tier.includes("中")) return "b";
  if (t.startsWith("C") || tier.includes("低")) return "c";
  return "none";
}

/** 与驾驶舱/卡片风一致：细色条 + 浅底描边徽章，避免高饱和实心按钮感 */
const TIER_VISUAL: Record<Exclude<ReturnType<typeof resolveTierKey>, "none">, TierVisual> = {
  s: {
    bar: "bg-destructive/75",
    badge:
      "border border-destructive/35 bg-destructive/10 text-destructive dark:border-destructive/45 dark:bg-destructive/15 dark:text-destructive",
    surface: "bg-card",
    latestStripe: "border-destructive/20 bg-destructive/[0.06] dark:border-destructive/30 dark:bg-destructive/10",
  },
  a: {
    bar: "bg-amber-500/75",
    badge:
      "border border-amber-500/35 bg-amber-500/10 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-100",
    surface: "bg-card",
    latestStripe: "border-amber-500/25 bg-amber-500/[0.07] dark:border-amber-900/40 dark:bg-amber-950/30",
  },
  b: {
    bar: "bg-primary/70",
    badge:
      "border border-primary/30 bg-primary/10 text-foreground dark:border-primary/35 dark:bg-primary/15",
    surface: "bg-card",
    latestStripe: "border-primary/20 bg-primary/[0.06] dark:border-primary/30 dark:bg-primary/10",
  },
  c: {
    bar: "bg-emerald-600/65",
    badge:
      "border border-emerald-500/35 bg-emerald-500/10 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-100",
    surface: "bg-card",
    latestStripe: "border-emerald-500/25 bg-emerald-500/[0.06] dark:border-emerald-900/35 dark:bg-emerald-950/25",
  },
};

const NONE_VISUAL: TierVisual = {
  bar: "bg-muted-foreground/35",
  badge: "border border-border bg-muted/60 text-muted-foreground",
  surface: "bg-card",
  latestStripe: "border-border bg-muted/30",
};

export function getTierVisual(tier: string | null | undefined): TierVisual {
  const key = resolveTierKey(tier);
  if (key === "none") return NONE_VISUAL;
  return TIER_VISUAL[key];
}

/** @deprecated 使用 getTierVisual；保留兼容 */
export function getTierBadgeClass(tier: string | null | undefined): string {
  return getTierVisual(tier).badge;
}
