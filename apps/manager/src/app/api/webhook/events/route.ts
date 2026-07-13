import * as fs from "fs"
import * as path from "path"

export const dynamic = "force-dynamic"

const EVENTS_FILE = path.join(process.cwd(), "webhook-events.json")

export async function GET() {
  const encoder = new TextEncoder()

  // Ensure the file exists
  if (!fs.existsSync(EVENTS_FILE)) {
    fs.writeFileSync(EVENTS_FILE, "[]", "utf-8")
  }

  let lastMtime = fs.statSync(EVENTS_FILE).mtimeMs
  let lastEventCount = 0
  try {
    lastEventCount = JSON.parse(fs.readFileSync(EVENTS_FILE, "utf-8")).length
  } catch {}

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode(": connected\n\n"))

      const interval = setInterval(() => {
        try {
          const stat = fs.statSync(EVENTS_FILE)
          if (stat.mtimeMs !== lastMtime) {
            lastMtime = stat.mtimeMs
            try {
              const events: any[] = JSON.parse(fs.readFileSync(EVENTS_FILE, "utf-8"))
              if (events.length > lastEventCount) {
                const newEvents = events.slice(lastEventCount)
                lastEventCount = events.length
                for (const ev of newEvents) {
                  const data = JSON.stringify(ev)
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                }
              }
            } catch {}
          }
          // Send heartbeat every ~15s to keep connection alive
          controller.enqueue(encoder.encode(": heartbeat\n\n"))
        } catch {
          clearInterval(interval)
          try { controller.close() } catch {}
        }
      }, 15000)

      // Also watch file directly for fast updates
      fs.watchFile(EVENTS_FILE, { interval: 500 }, (curr) => {
        if (curr.mtimeMs !== lastMtime) {
          lastMtime = curr.mtimeMs
          try {
            const events: any[] = JSON.parse(fs.readFileSync(EVENTS_FILE, "utf-8"))
            if (events.length > lastEventCount) {
              const newEvents = events.slice(lastEventCount)
              lastEventCount = events.length
              for (const ev of newEvents) {
                const data = JSON.stringify(ev)
                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
              }
            }
          } catch {}
        }
      })

      // Cleanup on cancel
      return () => {
        clearInterval(interval)
        fs.unwatchFile(EVENTS_FILE)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
