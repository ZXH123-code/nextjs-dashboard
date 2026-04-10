const shimmer =
  "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent";

function SkeletonBar({ className }: { className: string }) {
  return <div className={`${shimmer} relative overflow-hidden rounded bg-muted ${className}`} />;
}

export default function Loading() {
  return (
    <main className="p-6 md:p-8">
      <SkeletonBar className="mb-2 h-8 w-48" />
      <SkeletonBar className="mb-6 h-4 w-full max-w-xl" />
      <div className="mb-4 flex gap-2">
        <SkeletonBar className="h-9 w-28" />
        <SkeletonBar className="h-9 w-28" />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <SkeletonBar className="h-24 w-full" />
        <SkeletonBar className="h-24 w-full" />
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <SkeletonBar className="h-64 w-full" />
      </div>
    </main>
  );
}
