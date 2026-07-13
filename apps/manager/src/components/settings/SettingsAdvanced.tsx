"use client"

import { useState, useEffect } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

export function SettingsAdvanced() {
  const [logLevel, setLogLevel] = useState<"error" | "warn" | "info" | "debug">("warn")

  useEffect(() => {
    const savedLogLevel = localStorage.getItem("log-level")
    if (savedLogLevel === "error" || savedLogLevel === "warn" || savedLogLevel === "info" || savedLogLevel === "debug") {
      setLogLevel(savedLogLevel)
    }
  }, [])

  const handleLogLevelChange = (val: string) => {
    if (val === "error" || val === "warn" || val === "info" || val === "debug") {
      setLogLevel(val)
      localStorage.setItem("log-level", val)
    }
  }

  const handleClearLocalData = () => {
    toast("Clear all local data?", {
      description: "This will remove all cached scores, tags, history and preferences.",
      action: {
        label: "Clear",
        onClick: () => {
          localStorage.clear()
          window.location.reload()
        },
      },
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logging</CardTitle>
          <CardDescription>
            Controls verbosity of cv-api integration logs in the browser console.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="log-level-select">Log Level</Label>
            <Select value={logLevel} onValueChange={handleLogLevelChange}>
              <SelectTrigger id="log-level-select" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="error">error</SelectItem>
                <SelectItem value="warn">warn</SelectItem>
                <SelectItem value="info">info</SelectItem>
                <SelectItem value="debug">debug</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Local Data</CardTitle>
          <CardDescription>
            Clear all data stored in the browser, including scores, tags, history, and preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearLocalData}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear all local data
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
