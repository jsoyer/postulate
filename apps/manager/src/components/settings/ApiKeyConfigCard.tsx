"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const API_KEY_PROVIDERS = [
  { provider: "Gemini", envVar: "GEMINI_API_KEY", url: "https://aistudio.google.com/apikey" },
  { provider: "Claude (Anthropic)", envVar: "ANTHROPIC_API_KEY", url: "https://console.anthropic.com/" },
  { provider: "OpenAI", envVar: "OPENAI_API_KEY", url: "https://platform.openai.com/api-keys" },
  { provider: "Mistral", envVar: "MISTRAL_API_KEY", url: "https://console.mistral.ai/" },
  { provider: "Ollama", envVar: "(no key needed)", url: "https://ollama.com" },
] as const

export function ApiKeyConfigCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">API Key Configuration</CardTitle>
        <CardDescription>
          API keys are set as environment variables on the cv-api server, not stored here.
          Edit your cv-api <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code> file or Docker environment to configure them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
          {API_KEY_PROVIDERS.map(({ provider, envVar, url }) => (
            <div key={provider} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="font-medium">{provider}</span>
                <code className="ml-2 text-xs bg-muted px-1 py-0.5 rounded text-muted-foreground">{envVar}</code>
              </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                Get key →
              </a>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
