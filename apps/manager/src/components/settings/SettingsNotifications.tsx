"use client"

import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "sonner"

export function SettingsNotifications() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission)
      setNotificationsEnabled(Notification.permission === "granted")
    }
  }, [])

  const handleToggle = async (enabled: boolean) => {
    if (!("Notification" in window)) {
      toast.error("Notifications not supported in this browser")
      return
    }
    if (enabled) {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
      if (permission === "granted") {
        setNotificationsEnabled(true)
        toast.success("Push notifications enabled")
      } else {
        setNotificationsEnabled(false)
        toast.error("Notification permission denied")
      }
    } else {
      setNotificationsEnabled(false)
      toast.info("Push notifications disabled")
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Push Notifications</CardTitle>
          <CardDescription>
            Receive browser notifications when actions complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications-toggle">Enable notifications</Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {notificationPermission === "denied"
                  ? "Permission denied — update your browser settings to allow notifications."
                  : notificationPermission === "granted"
                    ? "Permission granted"
                    : "Will prompt for permission when enabled"}
              </p>
            </div>
            <Switch
              id="notifications-toggle"
              checked={notificationsEnabled}
              onCheckedChange={handleToggle}
              disabled={notificationPermission === "denied"}
            />
          </div>

          {notificationPermission !== "denied" && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {notificationsEnabled ? "Unsubscribe" : "Subscribe"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manually manage notification subscription
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggle(!notificationsEnabled)}
                >
                  <Bell className="w-3.5 h-3.5" />
                  {notificationsEnabled ? "Unsubscribe" : "Subscribe"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
