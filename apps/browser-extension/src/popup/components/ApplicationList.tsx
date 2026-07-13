import type { Application, ApplicationStatus } from "../../lib/types"
import { STATUS_COLORS } from "../../lib/constants"

interface ApplicationListProps {
  applications: Application[]
  isLoading: boolean
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  ghosted: "Ghosted",
}

function ApplicationRow({ app }: { app: Application }) {
  const color = STATUS_COLORS[app.status] ?? "#6b7280"
  const label = STATUS_LABELS[app.status as ApplicationStatus] ?? app.status
  const createdDate = new Date(app.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })

  return (
    <li className="flex items-start justify-between gap-2 py-2.5 border-b border-white/5 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{app.position}</p>
        <p className="truncate text-xs text-gray-400">{app.company}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `${color}22`, color }}
        >
          {label}
        </span>
        <span className="text-xs text-gray-500">{createdDate}</span>
      </div>
    </li>
  )
}

function SkeletonRow() {
  return (
    <li className="flex items-start justify-between gap-2 py-2.5 border-b border-white/5 last:border-0">
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-3/4 rounded bg-white/10 animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-white/10 animate-pulse" />
      </div>
      <div className="h-5 w-14 rounded-full bg-white/10 animate-pulse" />
    </li>
  )
}

export function ApplicationList({ applications, isLoading }: ApplicationListProps) {
  if (isLoading) {
    return (
      <ul className="divide-y divide-white/5">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </ul>
    )
  }

  if (applications.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-400">No applications yet.</p>
        <p className="mt-1 text-xs text-gray-500">
          Visit a job page and click "Add to Pipeline".
        </p>
      </div>
    )
  }

  return (
    <ul>
      {applications.map((app) => (
        <ApplicationRow key={app.name} app={app} />
      ))}
    </ul>
  )
}
