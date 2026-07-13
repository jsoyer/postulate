import { browser } from "../../lib/browser"

interface QuickActionsProps {
  apiUrl: string
}

function openTab(url: string) {
  browser.tabs.create({ url })
}

export function QuickActions({ apiUrl }: QuickActionsProps) {
  const dashboardUrl = apiUrl.replace(/\/$/, "") + "/"

  return (
    <div className="flex gap-2">
      <button
        onClick={() => openTab(dashboardUrl)}
        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-gray-200 hover:bg-white/20 transition-colors"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
        Dashboard
      </button>

      <button
        onClick={() => browser.runtime.openOptionsPage()}
        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-gray-200 hover:bg-white/20 transition-colors"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        </svg>
        Settings
      </button>

      <button
        onClick={() =>
          openTab("https://www.linkedin.com/jobs/search/?keywords=")
        }
        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-gray-200 hover:bg-white/20 transition-colors"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        Search
      </button>
    </div>
  )
}
