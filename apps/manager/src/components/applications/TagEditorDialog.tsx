"use client"

import { useState, useEffect, useCallback } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useTags, useUpdateTags } from "@/lib/api-hooks"
import { toast } from "sonner"

interface TagEditorDialogProps {
  appName: string
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function TagEditorDialog({ appName, open, onClose, onSaved }: TagEditorDialogProps) {
  const [tags, setTags] = useState<string[]>([])
  const [input, setInput] = useState("")
  const { data: tagsData } = useTags(appName)
  const updateTags = useUpdateTags()

  useEffect(() => {
    if (open) {
      setTags(tagsData?.tags ?? [])
      setInput("")
    }
  }, [open, appName, tagsData])

  const addTag = useCallback((raw: string) => {
    const trimmed = raw.trim().toLowerCase().replace(/,/g, "")
    if (!trimmed) return
    setTags((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
    setInput("")
  }, [])

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(input)
    }
    if (e.key === "Backspace" && input === "" && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  const handleSave = async () => {
    const finalTags = input.trim()
      ? [...tags.filter((t) => t !== input.trim().toLowerCase()), input.trim().toLowerCase()]
      : tags
    await updateTags.mutateAsync({ name: appName, tags: finalTags })
    toast.success("Tags saved")
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Tags — {appName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-wrap gap-1.5 min-h-8">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {tags.length === 0 && (
              <span className="text-xs text-slate-400 italic">No tags yet</span>
            )}
          </div>

          <div className="space-y-1">
            <Input
              placeholder="Add tag... (Enter or comma to confirm)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              autoFocus
            />
            <p className="text-xs text-slate-400">Press Enter or comma to add. Backspace removes last tag.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
