import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"

const TEMPLATES_PATH = path.join(process.cwd(), "templates.json")

interface Template {
  name: string
  template: { position: string }
}

function readTemplates(): Template[] {
  try {
    if (!fs.existsSync(TEMPLATES_PATH)) return []
    return JSON.parse(fs.readFileSync(TEMPLATES_PATH, "utf-8"))
  } catch {
    return []
  }
}

function writeTemplates(templates: Template[]): void {
  fs.writeFileSync(TEMPLATES_PATH, JSON.stringify(templates, null, 2), "utf-8")
}

export async function GET() {
  return NextResponse.json(readTemplates())
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, name, template } = body

    if (!action || !name) {
      return NextResponse.json({ error: "action and name required" }, { status: 400 })
    }

    let templates = readTemplates()

    if (action === "save") {
      if (!template) {
        return NextResponse.json({ error: "template required for save" }, { status: 400 })
      }
      const existing = templates.findIndex(t => t.name === name)
      if (existing >= 0) {
        templates[existing] = { name, template }
      } else {
        templates.push({ name, template })
      }
      writeTemplates(templates)
      return NextResponse.json({ ok: true })
    }

    if (action === "delete") {
      templates = templates.filter(t => t.name !== name)
      writeTemplates(templates)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
