"use client"

import React from "react"

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[ErrorBoundary] Caught error:", error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback != null) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-8">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
              Something went wrong
            </h2>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              An unexpected error occurred. You can try again or return to the dashboard.
            </p>
            {this.state.error != null && (
              <code className="mb-6 block overflow-auto rounded-md bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {this.state.error.message}
              </code>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Try again
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Go to dashboard
              </a>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
) {
  return function Wrapped(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}
