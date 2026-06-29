import { cn } from "@/lib/utils";

/** A shimmering placeholder block used by route-level loading.tsx screens. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-black/[0.06]", className)} />;
}

/** Generic list-page skeleton: title, search, summary, then a few cards. */
export function ListPageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="mx-auto max-w-3xl px-3 py-4 md:px-6">
      <Skeleton className="mb-3 h-7 w-32" />
      <Skeleton className="mb-3 h-11 w-full" />
      <Skeleton className="mb-4 h-24 w-full rounded-2xl" />
      <div className="space-y-3">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
