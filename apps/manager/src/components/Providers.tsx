"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { SelectedAppProvider } from "@/components/SelectedAppContext"
import { TooltipProvider } from "@/components/ui/tooltip"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: (failureCount, error) => {
              if (error instanceof Error && error.message.includes("404")) return false
              return failureCount < 2
            },
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <SelectedAppProvider>
        <TooltipProvider delayDuration={300}>
          {children}
        </TooltipProvider>
      </SelectedAppProvider>
    </QueryClientProvider>
  )
}
