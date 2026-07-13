"use client"

import { useQuery } from "@tanstack/react-query"

export function useDefaultAI(): { defaultAI: string; defaultModel: string } {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings")
      return res.json()
    },
    staleTime: 60_000,
  })
  return {
    defaultAI: data?.default_ai ?? "gemini",
    defaultModel: data?.default_model ?? "",
  }
}
