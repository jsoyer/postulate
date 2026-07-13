import { getCvApiClient, ApiError } from "@/lib/api-client"

function toICalDate(dateStr: string): string | null {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}${mm}${dd}`
  } catch {
    return null
  }
}

function escapeIcal(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

interface Milestone {
  date?: string
  event?: string
}

export async function GET() {
  try {
    const client = getCvApiClient()
    const apps = await client.listApplications()

    let ical = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//CV Manager//EN\r\nCALSCALE:GREGORIAN\r\n"

    for (const app of apps) {
      // Deadline event
      if (app.deadline) {
        const dateStr = toICalDate(String(app.deadline))
        if (dateStr) {
          ical += "BEGIN:VEVENT\r\n"
          ical += `UID:deadline-${app.name}@cvmanager\r\n`
          ical += `DTSTART;VALUE=DATE:${dateStr}\r\n`
          ical += `DTEND;VALUE=DATE:${dateStr}\r\n`
          ical += `SUMMARY:${escapeIcal(`Deadline - ${app.company}`)}\r\n`
          ical += `DESCRIPTION:${escapeIcal(`${app.position} at ${app.company}`)}\r\n`
          ical += "END:VEVENT\r\n"
        }
      }

      // Fetch full application to get milestones.yml from files
      try {
        const full = await client.getApplication(app.name)
        const milestonesYml = full.files?.["milestones.yml"]
        if (milestonesYml) {
          // Parse YAML array from the file content (simple line-based parsing)
          const milestones = parseMilestones(milestonesYml)
          for (let i = 0; i < milestones.length; i++) {
            const m = milestones[i]
            if (!m.date) continue
            const dateStr = toICalDate(String(m.date))
            if (!dateStr) continue
            const event = m.event || "Milestone"
            ical += "BEGIN:VEVENT\r\n"
            ical += `UID:milestone-${app.name}-${i}@cvmanager\r\n`
            ical += `DTSTART;VALUE=DATE:${dateStr}\r\n`
            ical += `DTEND;VALUE=DATE:${dateStr}\r\n`
            ical += `SUMMARY:${escapeIcal(`${app.company} - ${event}`)}\r\n`
            ical += `DESCRIPTION:${escapeIcal(`${app.position} at ${app.company}`)}\r\n`
            ical += "END:VEVENT\r\n"
          }
        }
      } catch {
        // Skip apps where full fetch fails
      }
    }

    ical += "END:VCALENDAR\r\n"

    return new Response(ical, {
      headers: {
        "Content-Type": "text/calendar",
        "Content-Disposition": 'attachment; filename="cv-deadlines.ics"',
      },
    })
  } catch (error) {
    const msg = error instanceof ApiError ? error.body.message : String(error)
    return new Response(`Error: ${msg}`, { status: 500 })
  }
}

/**
 * Simple YAML array parser for milestones.yml.
 * Expected format:
 *   - date: 2026-03-01
 *     event: Phone screen
 */
function parseMilestones(yml: string): Milestone[] {
  const milestones: Milestone[] = []
  let current: Milestone | null = null

  for (const line of yml.split("\n")) {
    const trimmed = line.trim()
    if (trimmed.startsWith("- ")) {
      if (current) milestones.push(current)
      current = {}
      const rest = trimmed.slice(2).trim()
      const match = rest.match(/^(\w+):\s*(.+)$/)
      if (match) {
        const [, key, value] = match
        if (key === "date") current.date = value.trim()
        if (key === "event") current.event = value.trim()
      }
    } else if (current && trimmed.match(/^\w+:/)) {
      const match = trimmed.match(/^(\w+):\s*(.+)$/)
      if (match) {
        const [, key, value] = match
        if (key === "date") current.date = value.trim()
        if (key === "event") current.event = value.trim()
      }
    }
  }
  if (current) milestones.push(current)

  return milestones
}
