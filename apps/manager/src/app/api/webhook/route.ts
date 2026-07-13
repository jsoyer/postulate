import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"

const EVENTS_FILE = path.join(process.cwd(), "webhook-events.json")

function readEvents(): any[] {
  try {
    if (fs.existsSync(EVENTS_FILE)) {
      return JSON.parse(fs.readFileSync(EVENTS_FILE, "utf-8"))
    }
  } catch {}
  return []
}

export async function POST(request: Request) {
  try {
    // Check authorization if WEBHOOK_SECRET is set
    const secret = process.env.WEBHOOK_SECRET
    if (secret) {
      const authHeader = request.headers.get("Authorization")
      if (!authHeader || authHeader !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const body = await request.json()
    const { event, name } = body

    if (!event || typeof event !== "string") {
      return NextResponse.json({ error: "event field required" }, { status: 400 })
    }

    const entry = {
      event,
      name: name || null,
      timestamp: new Date().toISOString(),
    }

    const events = readEvents()
    events.push(entry)
    // Keep last 100 events
    const trimmed = events.slice(-100)
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(trimmed, null, 2), "utf-8")

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
