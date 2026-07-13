import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full space-y-3" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-1">
          <Skeleton className="w-9 h-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("w-full", className)} aria-busy="true" aria-label="Loading card">
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-1/3" />
      </CardHeader>
      <CardContent className="space-y-2.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-4/6" />
      </CardContent>
    </Card>
  )
}

export function StatsSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-4"
      aria-busy="true"
      aria-label="Loading statistics"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-4 space-y-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-2/3" />
        </Card>
      ))}
    </div>
  )
}
