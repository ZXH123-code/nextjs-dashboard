"use client";

const shimmer =
  "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`${shimmer} relative overflow-hidden rounded bg-muted ${className}`}
    />
  );
}

export function LeadsTableSkeleton() {
  return (
    <div className="space-y-3">
      {/* 筛选栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SkeletonBar className="h-9 w-20" />
          <SkeletonBar className="h-9 w-24" />
        </div>
        <SkeletonBar className="h-4 w-28" />
      </div>

      {/* 表格 */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="min-w-[980px] w-full table-fixed text-left text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="w-10 px-4 py-3" />
              <th className="w-[170px] px-4 py-3">
                <SkeletonBar className="h-4 w-16" />
              </th>
              <th className="w-[120px] px-4 py-3">
                <SkeletonBar className="h-4 w-12" />
              </th>
              <th className="w-[96px] px-4 py-3">
                <SkeletonBar className="h-4 w-10" />
              </th>
              <th className="w-[110px] px-4 py-3">
                <SkeletonBar className="h-4 w-10" />
              </th>
              <th className="w-[130px] px-4 py-3">
                <SkeletonBar className="h-4 w-16" />
              </th>
              <th className="w-[130px] px-4 py-3">
                <SkeletonBar className="h-4 w-16" />
              </th>
              <th className="w-[120px] px-4 py-3">
                <SkeletonBar className="h-4 w-14" />
              </th>
              <th className="w-[130px] px-4 py-3">
                <SkeletonBar className="h-4 w-16" />
              </th>
              <th className="w-[110px] px-4 py-3">
                <SkeletonBar className="h-4 w-10" />
              </th>
              <th className="w-[120px] px-4 py-3">
                <SkeletonBar className="h-4 w-16" />
              </th>
              <th className="w-[130px] px-4 py-3">
                <SkeletonBar className="h-4 w-12" />
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }).map((_, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <SkeletonBar className="h-4 w-4 mx-auto" />
                </td>
                <td className="px-4 py-3">
                  <SkeletonBar className="h-4 w-[85%]" />
                </td>
                <td className="px-4 py-3">
                  <SkeletonBar className="h-4 w-[70%]" />
                </td>
                <td className="px-4 py-3">
                  <SkeletonBar className="h-4 w-[60%]" />
                </td>
                <td className="px-4 py-3">
                  <SkeletonBar className="h-4 w-[65%]" />
                </td>
                <td className="px-4 py-3">
                  <SkeletonBar className="h-4 w-[70%]" />
                </td>
                <td className="px-4 py-3">
                  <SkeletonBar className="h-4 w-[75%]" />
                </td>
                <td className="px-4 py-3">
                  <SkeletonBar className="h-4 w-20" />
                </td>
                <td className="px-4 py-3">
                  <SkeletonBar className="h-4 w-[60%]" />
                </td>
                <td className="px-4 py-3">
                  <SkeletonBar className="h-4 w-16" />
                </td>
                <td className="px-4 py-3">
                  <SkeletonBar className="h-4 w-14" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <SkeletonBar className="h-7 w-16" />
                    <SkeletonBar className="h-7 w-7" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页栏 */}
      <nav className="flex items-center justify-between gap-4 border-t bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <SkeletonBar className="h-4 w-6" />
          <SkeletonBar className="h-8 w-[72px]" />
        </div>
        <div className="flex items-center gap-1">
          <SkeletonBar className="h-8 w-8" />
          <div className="flex gap-1 mx-1">
            <SkeletonBar className="h-8 w-8" />
            <SkeletonBar className="h-8 w-8" />
            <SkeletonBar className="h-8 w-8" />
          </div>
          <SkeletonBar className="h-8 w-8" />
        </div>
      </nav>
    </div>
  );
}
