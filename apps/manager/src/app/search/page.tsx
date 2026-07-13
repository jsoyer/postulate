"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Search, FileText, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type StageVariant = "applied" | "interview" | "offer" | "rejected" | "ghosted"

function stageBadgeVariant(stage: string): StageVariant {
  const valid: StageVariant[] = ["applied", "interview", "offer", "rejected", "ghosted"]
  return valid.includes(stage as StageVariant) ? (stage as StageVariant) : "applied"
}

function HighlightedText({ text, query }: { text: string; query: string }): React.ReactNode {
  if (!query || !text) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-800/70 dark:text-yellow-100 rounded px-0.5 not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function ResultSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <Separator />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>
    </Card>
  )
}

interface SearchMatch {
  file: string
  snippet: string
}

interface SearchResult {
  name: string
  company: string
  position: string
  stage: string
  matches: SearchMatch[]
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 3) return { results: [] }
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      return res.json()
    },
    enabled: debouncedQuery.length >= 3,
  })

  const results: SearchResult[] = data?.results || []
  const showResults = debouncedQuery.length >= 3
  const showSkeletons = showResults && (isLoading || isFetching)

  return (
    <div className="p-4 md:p-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Search</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          Search across all application files
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search job descriptions, prep notes, research…"
          className="pl-9 pr-10 h-11 text-base"
        />
        {(isLoading || isFetching) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {query.length > 0 && query.length < 3 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Type at least 3 characters to search
        </p>
      )}

      {showSkeletons && (
        <div className="space-y-4">
          <ResultSkeleton />
          <ResultSkeleton />
        </div>
      )}

      {showResults && !isLoading && !isFetching && (
        <>
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Search className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-slate-700 dark:text-slate-300 font-medium">No results found</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                No applications match &quot;{debouncedQuery}&quot;
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {results.length} application{results.length !== 1 ? "s" : ""} found
              </p>
              {results.map(result => (
                <Card key={result.name} className="overflow-hidden">
                  <CardHeader className="pb-0 px-5 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {result.company}
                          </span>
                          <Badge variant={stageBadgeVariant(result.stage)} className="capitalize shrink-0">
                            {result.stage}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {result.position}
                        </p>
                      </div>
                      <Link
                        href={`/applications/${result.name}`}
                        className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 shrink-0 transition-colors"
                      >
                        View
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 pb-4 pt-3">
                    <Separator className="mb-3" />
                    <div className="space-y-3">
                      {result.matches.map((match, i) => (
                        <div key={i}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                              {match.file}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                            <HighlightedText text={match.snippet} query={debouncedQuery} />
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
