import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-3 py-4 md:px-6">
      <Skeleton className="mb-4 h-6 w-24" />
      <Skeleton className="mb-3 h-28 w-full rounded-2xl" />
      <Skeleton className="mb-3 h-40 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}
