import { NextResponse } from "next/server"
import { execFile } from "child_process"
import { promisify } from "util"
import path from "path"

const execFileAsync = promisify(execFile)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const keywords = (searchParams.get("keywords") || "").trim()
  const location = (searchParams.get("location") || "").trim()
  const limit = searchParams.get("limit") || "50"

  if (!keywords) {
    return NextResponse.json(
      { error: "keywords parameter is required" },
      { status: 400 }
    )
  }

  const cvPath = process.env.CV_PATH
  if (!cvPath) {
    return NextResponse.json(
      { error: "CV_PATH environment variable is not set" },
      { status: 500 }
    )
  }

  const scriptPath = path.join(cvPath, "scripts", "rss-discovery.py")
  const args = ["--keywords", keywords, "--json", "--limit", limit]

  if (location) {
    args.push("--location", location)
  }

  try {
    const { stdout } = await execFileAsync("python3", [scriptPath, ...args], {
      cwd: cvPath,
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    })

    const result = JSON.parse(stdout)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: `RSS discovery failed: ${message}` },
      { status: 500 }
    )
  }
}
