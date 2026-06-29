import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-3 py-4 md:px-6">
      <Skeleton className="mb-3 h-7 w-28" />
      <Skeleton className="mb-3 h-11 w-full" />
      {/* Week strip */}
      <div className="rounded-2xl border border-black/5 bg-card p-3 shadow-sm">
        <Skeleton className="mx-auto mb-2 h-5 w-40" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </div>
      {/* Agenda */}
      <div className="mt-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
