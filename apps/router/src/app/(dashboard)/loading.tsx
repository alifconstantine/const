import { Card, Skeleton } from "@const/ui";

export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* 1. Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 sm:h-10 w-56 rounded-2xl" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>

      {/* 2. KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="rounded-3xl border-border/70 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
            <div className="space-y-2 pt-1">
              <Skeleton className="h-8 w-32 rounded-lg" />
              <Skeleton className="h-3.5 w-24 rounded" />
            </div>
          </Card>
        ))}
      </div>

      {/* 3. Middle Content Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 2 Columns Wide */}
        <Card className="lg:col-span-2 rounded-3xl border-border/70 bg-card p-6 space-y-4 min-h-[300px] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40 rounded-lg" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
            <Skeleton className="h-3.5 w-64 rounded" />
          </div>
          <Skeleton className="h-44 w-full rounded-2xl" />
        </Card>

        {/* Right: 1 Column Wide */}
        <Card className="rounded-3xl border-border/70 bg-card p-6 space-y-4 min-h-[300px] flex flex-col justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32 rounded-lg" />
            <Skeleton className="h-3.5 w-48 rounded" />
          </div>
          <div className="space-y-3 py-2">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </Card>
      </div>

      {/* 4. Bottom Table / List Skeleton */}
      <Card className="rounded-3xl border-border/70 bg-card p-6 space-y-4">
        <div className="flex items-center justify-between pb-2">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-36 rounded-lg" />
            <Skeleton className="h-3.5 w-52 rounded" />
          </div>
          <Skeleton className="h-4 w-20 rounded" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
