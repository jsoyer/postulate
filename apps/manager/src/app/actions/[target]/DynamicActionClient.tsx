"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ActionRunner } from "@/components/ActionRunner"
import { useDefaultAI } from "@/hooks/useDefaultAI"
import { useSelectedApp } from "@/components/SelectedAppContext"
import { ACTION_REGISTRY, AI_PROVIDER_OPTIONS } from "@/lib/action-registry"

export default function DynamicActionClient({ action }: { action: typeof ACTION_REGISTRY[number] }) {
  const { defaultAI, defaultModel } = useDefaultAI()
  const { selectedApp } = useSelectedApp()

  const fieldsWithDefaults = action.fields.map(f => {
    if (f.name === "name" && selectedApp?.name && !f.defaultValue) {
      return { ...f, defaultValue: selectedApp.name }
    }
    return f
  })

  if (action.hasAI) {
    fieldsWithDefaults.push({
      name: "ai",
      label: "AI Provider",
      type: "select",
      options: AI_PROVIDER_OPTIONS,
      defaultValue: defaultAI,
    })
    if (defaultModel) {
      fieldsWithDefaults.push({
        name: "model",
        label: "Model (optional)",
        placeholder: "Leave empty for provider default",
        defaultValue: defaultModel,
      })
    }
  }

  const backLink = selectedApp
    ? `/applications/${selectedApp.name}`
    : null

  const backLabel = selectedApp
    ? selectedApp.company || selectedApp.name
    : ""

  return (
    <div className="space-y-4">
      {backLink && (
        <Link
          href={backLink}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to {backLabel}
        </Link>
      )}
      <ActionRunner
        action={action.slug}
        title={action.title}
        description={action.description}
        fields={fieldsWithDefaults}
      />
    </div>
  )
}
