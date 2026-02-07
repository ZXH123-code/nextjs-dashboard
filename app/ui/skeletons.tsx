// Loading animation
const shimmer =
  'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent';

export function CardSkeleton() {
  return (
    <div
      className={`${shimmer} relative overflow-hidden rounded-xl bg-gray-100 p-2 shadow-sm`}
    >
      <div className="flex p-4">
        <div className="h-5 w-5 rounded-md bg-gray-200" />
        <div className="ml-2 h-6 w-16 rounded-md bg-gray-200 text-sm font-medium" />
      </div>
      <div className="flex items-center justify-center truncate rounded-xl bg-white px-4 py-8">
        <div className="h-7 w-20 rounded-md bg-gray-200" />
      </div>
    </div>
  );
}

export function CardsSkeleton() {
  return (
    <>
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </>
  );
}

/** 单条跟进卡片骨架（与 FollowUpTimeline 卡片布局一致） */
function FollowUpCardSkeleton() {
  return (
    <div
      className={`${shimmer} relative overflow-hidden rounded-lg border border-gray-200 bg-white p-3`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-4 w-16 rounded bg-gray-200" />
          <div className="h-4 w-12 rounded bg-gray-100" />
        </div>
        <div className="h-3 w-24 rounded bg-gray-100" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-gray-100" />
        <div className="h-3 w-4/5 rounded bg-gray-100" />
        <div className="h-3 w-3/5 rounded bg-gray-100" />
      </div>
      <div className="mt-2 border-t border-gray-100 pt-2">
        <div className="h-3 w-20 rounded bg-gray-100" />
      </div>
    </div>
  );
}

/** 跟进时间线加载骨架：1 条卡片 + 底部按钮占位 */
export function FollowUpTimelineSkeleton() {
  return (
    <div className="space-y-3">
      <FollowUpCardSkeleton />
      <div
        className={`${shimmer} relative h-10 w-full overflow-hidden rounded-md border border-gray-200 bg-gray-50`}
      />
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <>
      <div
        className={`${shimmer} relative mb-4 h-8 w-36 overflow-hidden rounded-md bg-gray-100`}
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className={`${shimmer} relative mt-6 h-24 overflow-hidden rounded-xl bg-gray-100 p-6`} />
    </>
  );
}
