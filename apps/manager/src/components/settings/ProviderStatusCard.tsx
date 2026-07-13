"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const KNOWN_PROVIDERS = ["gemini", "claude", "openai", "mistral", "ollama"] as const

export function ProviderStatusCard() {
  const { data } = useQuery<{ status: string; ai_providers: Record<string, boolean> }>({
    queryKey: ["health"],
    queryFn: () => fetch("/api/health").then(r => r.json()),
    refetchInterval: 60_000,
  })

  const aiProviders: Record<string, boolean> = data?.ai_providers ?? {}

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Provider Status</CardTitle>
        <CardDescription>
          Live availability of AI providers detected by cv-api.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {KNOWN_PROVIDERS.map(name => {
            const available = aiProviders[name] === true
            return (
              <div key={name} className="flex items-center gap-3 text-sm">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${available ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"}`}
                />
                <span className="w-20 font-medium capitalize text-slate-900 dark:text-slate-100">{name}</span>
                <span className={available ? "text-green-600 dark:text-green-400" : "text-slate-400 dark:text-slate-500"}>
                  {available ? "Available" : "Not detected"}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
