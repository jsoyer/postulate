import type { ActionStatus } from "../../lib/types"
import { STATUS_COLORS } from "../../lib/constants"

interface PipelineStatusProps {
  status: ActionStatus
  label?: string
}

const STATUS_LABELS: Record<ActionStatus, string> = {
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
}

export function PipelineStatus({ status, label }: PipelineStatusProps) {
  const color = STATUS_COLORS[status] ?? "#6b7280"
  const text = label ?? STATUS_LABELS[status]

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}22`, color }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {text}
    </span>
  )
}
