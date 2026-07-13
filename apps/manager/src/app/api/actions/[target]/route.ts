import { NextResponse } from "next/server"
import { getCvApiClient, ApiError } from "@/lib/api-client"

/**
 * Dynamic action proxy — replaces 50+ individual action route files.
 * All Make target execution is delegated to cv-api.
 *
 * POST /api/actions/{target}
 * Body: { application?: string, args?: Record<string, string>, ...extra }
 *
 * Extra top-level keys (name, ai, stage, etc.) are auto-promoted to args
 * for backwards compatibility with the old per-target routes.
 *
 * GET /api/actions/{jobId}
 * Poll the status of a running or completed action job.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ target: string }> }
) {
  try {
    const { target: jobId } = await params
    const result = await getCvApiClient().getActionStatus(jobId)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.body.message },
        { status: error.statusCode }
      )
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ target: string }> }
) {
  try {
    const { target } = await params
    const body = await request.json()

    // Extract structured fields if present, otherwise treat all extra keys as args
    const { application, args: explicitArgs, ...rest } = body

    // Backwards compat: old routes passed { name, ai, stage, ... } as top-level keys.
    // Merge them into args (uppercased) so cv-api receives NAME=, AI=, STAGE=, etc.
    const args: Record<string, string> = {}

    // Explicit args take precedence
    if (explicitArgs && typeof explicitArgs === "object") {
      for (const [k, v] of Object.entries(explicitArgs)) {
        if (v && typeof v === "string" && v.trim()) {
          args[k] = v.trim()
        }
      }
    }

    // Promote remaining top-level keys (backwards compat)
    for (const [k, v] of Object.entries(rest)) {
      if (v && typeof v === "string" && v.trim()) {
        const key = k.toUpperCase()
        if (!(key in args)) {
          args[key] = v.trim()
        }
      }
    }

    // "name" is the most common arg from old routes — map to application if not set
    const app = application ?? rest.name ?? args.NAME

    const result = await getCvApiClient().executeAction(
      target,
      typeof app === "string" ? app : undefined,
      Object.keys(args).length > 0 ? args : undefined
    )

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.body.message },
        { status: error.statusCode }
      )
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
