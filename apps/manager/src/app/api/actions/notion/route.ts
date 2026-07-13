import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({
    success: false,
    stderr: "Notion sync is managed via GitHub Actions CI/CD. Configure NOTION_TOKEN and NOTION_DATABASE_ID in your .env file.",
  })
}
