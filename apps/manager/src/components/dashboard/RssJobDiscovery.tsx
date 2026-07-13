"use client"

import { useState, useCallback } from "react"
import { Search, ExternalLink, Plus, Loader2, AlertCircle, Bookmark } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { useMutateApplication } from "@/lib/api-hooks"
import type { RssJob, RssJobResponse } from "@/lib/api-types"

const PAGE_SIZE = 20

export function RssJobDiscovery() {
  const [keywords, setKeywords] = useState("")
  const [location, setLocation] = useState("")
  const [jobs, setJobs] = useState<RssJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [savedSearches, setSavedSearches] = useState<string[]>([])
  const [addingJob, setAddingJob] = useState<string | null>(null)

  const createApp = useMutateApplication()

  const fetchJobs = useCallback(async (kw: string, loc: string, pageNum: number = 0) => {
    if (!kw.trim()) return
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        keywords: kw.trim(),
        limit: String(PAGE_SIZE),
      })
      if (loc.trim()) params.set("location", loc.trim())

      const res = await fetch(`/api/discover?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Request failed" }))
        throw new Error(body.error || `HTTP ${res.status}`)
      }

      const data: RssJobResponse = await res.json()
      if (pageNum === 0) {
        setJobs(data.jobs)
      } else {
        setJobs(prev => [...prev, ...data.jobs])
      }
      setTotal(data.total)
      setPage(pageNum)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch jobs")
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(0)
    fetchJobs(keywords, location, 0)
  }

  const handleLoadMore = () => {
    fetchJobs(keywords, location, page + 1)
  }

  const handleSaveSearch = () => {
    if (!keywords.trim() || savedSearches.includes(keywords.trim())) return
    setSavedSearches(prev => [...prev, keywords.trim()])
  }

  const handleAddToPipeline = (job: RssJob) => {
    setAddingJob(job.title)
    createApp.mutate(
      { company: job.company, position: job.title, url: job.url },
      {
        onSuccess: () => setAddingJob(null),
        onError: () => setAddingJob(null),
      }
    )
  }

  const handleSavedSearch = (kw: string) => {
    setKeywords(kw)
    setPage(0)
    fetchJobs(kw, location, 0)
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Job Discovery</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveSearch}
            disabled={!keywords.trim() || savedSearches.includes(keywords.trim())}
          >
            <Bookmark className="w-3.5 h-3.5 mr-1.5" />
            Save Search
          </Button>
        </div>
        <CardDescription>Find opportunities from RSS feeds across job boards</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Form */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Keywords (e.g. python,go,remote)"
            value={keywords}
            onChange={e => setKeywords(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Location (optional)"
            value={location}
            onChange={e => setLocation(e.target.value)}
            className="sm:w-40"
          />
          <Button type="submit" disabled={loading || !keywords.trim()}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            Search
          </Button>
        </form>

        {/* Saved Searches */}
        {savedSearches.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {savedSearches.map(kw => (
              <Badge
                key={kw}
                variant="outline"
                className="cursor-pointer hover:bg-accent"
                onClick={() => handleSavedSearch(kw)}
              >
                {kw}
              </Badge>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading && jobs.length === 0 && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg border space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && jobs.length === 0 && keywords && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No jobs found matching &ldquo;{keywords}&rdquo;</p>
            <p className="text-xs mt-1">Try different keywords or remove the location filter</p>
          </div>
        )}

        {/* Results */}
        {jobs.length > 0 && (
          <>
            <div className="space-y-2">
              {jobs.map((job, i) => (
                <div
                  key={`${job.source}-${i}`}
                  className="p-3 rounded-lg border hover:border-accent transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-foreground truncate">
                          {job.title}
                        </h4>
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {job.company} &middot; {job.location} &middot; {job.posted}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {job.keywords_matched.slice(0, 4).map(kw => (
                          <Badge key={kw} variant="secondary" className="text-xs px-1.5 py-0">
                            {kw}
                          </Badge>
                        ))}
                        {job.keywords_matched.length > 4 && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            +{job.keywords_matched.length - 4}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs px-1.5 py-0 capitalize">
                          {job.source}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs"
                      onClick={() => handleAddToPipeline(job)}
                      disabled={addingJob === job.title}
                    >
                      {addingJob === job.title ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span className="ml-1 hidden sm:inline">Add</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More */}
            {jobs.length < total && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Load More ({jobs.length}/{total})
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
