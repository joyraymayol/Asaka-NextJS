import { Skeleton } from "@/components/ui/skeleton";

// Next automatically wraps the /routes page in a Suspense boundary using
// this file, for BOTH hard navigations and client-side router.push() -- the
// route can take a while (a multi-day window means fetching + outlier
// filtering + decimating thousands of positions), and without this the user
// just sits on the previous page with no feedback until it's fully ready.
export default function RouteLoading() {
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading route…</p>
      </div>
    </div>
  );
}
