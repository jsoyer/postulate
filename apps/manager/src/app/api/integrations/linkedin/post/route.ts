import { NextRequest, NextResponse } from "next/server"
import { getIntegrations, saveLinkedInProfileId } from "@/lib/integrations-store"

async function getProfileId(accessToken: string): Promise<string> {
  const config = getIntegrations()
  if (config.linkedin?.profileId) {
    return config.linkedin.profileId
  }

  const res = await fetch("https://api.linkedin.com/v2/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch LinkedIn profile: ${res.status}`)
  }

  const data = (await res.json()) as { id: string }
  saveLinkedInProfileId(data.id)
  return data.id
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { text } = body as Record<string, unknown>

  if (!text || typeof text !== "string" || text.trim() === "") {
    return NextResponse.json({ error: "text is required" }, { status: 400 })
  }

  const config = getIntegrations()
  const token = config.linkedin?.accessToken

  if (!token) {
    return NextResponse.json({ error: "LinkedIn not connected" }, { status: 401 })
  }

  try {
    const profileId = await getProfileId(token)

    const postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: `urn:li:person:${profileId}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: text.trim() },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      }),
    })

    if (!postRes.ok) {
      const errData = await postRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: (errData as { message?: string }).message ?? `LinkedIn API error: ${postRes.status}` },
        { status: postRes.status }
      )
    }

    const postData = (await postRes.json()) as { id: string }
    return NextResponse.json({ ok: true, postId: postData.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
