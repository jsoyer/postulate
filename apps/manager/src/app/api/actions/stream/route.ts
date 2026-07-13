import { NextResponse } from "next/server"
import { getCvApiClient, ApiError } from "@/lib/api-client"

/**
 * SSE streaming proxy — connects to cv-api WebSocket and re-emits as SSE.
 *
 * POST /api/actions/stream
 * Body: { target: string, application?: string, args?: Record<string, string>, ...extra }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { target, application, args: explicitArgs, ...rest } = body

    if (!target) {
      return NextResponse.json({ error: "target is required" }, { status: 400 })
    }

    const app = application ?? rest.name

    // Build args from explicit args + top-level keys (backwards compat)
    const args: Record<string, string> = {}
    if (explicitArgs && typeof explicitArgs === "object") {
      for (const [k, v] of Object.entries(explicitArgs)) {
        if (v && typeof v === "string" && v.trim()) args[k] = v.trim()
      }
    }
    for (const [k, v] of Object.entries(rest)) {
      if (v && typeof v === "string" && v.trim()) {
        const key = k.toUpperCase()
        if (!(key in args)) args[key] = v.trim()
      }
    }

    // Execute via cv-api (blocking) and return result as SSE
    const result = await getCvApiClient().executeAction(
      target,
      typeof app === "string" ? app : undefined,
      Object.keys(args).length > 0 ? args : undefined
    )

    // Re-emit stdout/stderr as SSE events for backwards compatibility
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        if (result.stdout) {
          for (const line of result.stdout.split("\n")) {
            if (line.trim()) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "stdout", line })}\n\n`)
              )
            }
          }
        }
        if (result.stderr) {
          for (const line of result.stderr.split("\n")) {
            if (line.trim()) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "stderr", line })}\n\n`)
              )
            }
          }
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done", code: result.exit_code })}\n\n`)
        )
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
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
