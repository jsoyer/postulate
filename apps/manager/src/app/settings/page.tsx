"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import {
  Globe,
  Bell,
  Bot,
  Info,
  Palette,
  SlidersHorizontal,
  ShieldCheck,
  Plug,
  FileText,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { SettingsApiConfig } from "@/components/settings/SettingsApiConfig"
import { SettingsTheme } from "@/components/settings/SettingsTheme"
import { SettingsNotifications } from "@/components/settings/SettingsNotifications"
import { SettingsAI } from "@/components/settings/SettingsAI"
import { SettingsSecurity } from "@/components/settings/SettingsSecurity"
import { SettingsIntegrations } from "@/components/settings/SettingsIntegrations"
import { SettingsAdvanced } from "@/components/settings/SettingsAdvanced"
import { SettingsPdfa } from "@/components/settings/SettingsPdfa"

function SettingsPageInner() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const VALID_TABS = ["general", "appearance", "notifications", "ai", "advanced", "security", "about", "integrations", "pdfa"]
  const [activeTab, setActiveTab] = useState(
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : "general"
  )

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          Configure your CV Manager
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="general" className="gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5">
            <Palette className="w-3.5 h-3.5" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5">
            <Bot className="w-3.5 h-3.5" />
            AI
          </TabsTrigger>
          <TabsTrigger value="advanced" className="gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Advanced
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Security
          </TabsTrigger>
          <TabsTrigger value="about" className="gap-1.5">
            <Info className="w-3.5 h-3.5" />
            About
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-1.5">
            <Plug className="w-3.5 h-3.5" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="pdfa" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            PDF/A
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <SettingsApiConfig />
        </TabsContent>

        <TabsContent value="appearance" className="mt-6">
          <SettingsTheme />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <SettingsNotifications />
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <SettingsAI />
        </TabsContent>

        <TabsContent value="advanced" className="mt-6">
          <SettingsAdvanced />
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <SettingsSecurity />
        </TabsContent>

        <TabsContent value="about" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">CV Manager</CardTitle>
              <CardDescription>
                Personal job application management tool.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <span className="text-slate-500 dark:text-slate-400">Version</span>
                <span className="font-mono text-slate-900 dark:text-slate-100">0.1.0</span>
                <span className="text-slate-500 dark:text-slate-400">Framework</span>
                <span className="font-mono text-slate-900 dark:text-slate-100">Next.js 16</span>
                <span className="text-slate-500 dark:text-slate-400">Runtime</span>
                <span className="font-mono text-slate-900 dark:text-slate-100">React 19</span>
                <span className="text-slate-500 dark:text-slate-400">Storage</span>
                <span className="font-mono text-slate-900 dark:text-slate-100">Filesystem + LocalStorage</span>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <p className="font-medium text-slate-900 dark:text-slate-100">Environment Variables</p>
                <ul className="space-y-1 text-slate-500 dark:text-slate-400 font-mono text-xs">
                  <li>CV_PATH — path to CV project directory</li>
                  <li>AUTH_SECRET — JWT signing secret</li>
                  <li>AUTH_USERNAME — login username</li>
                  <li>AUTH_PASSWORD — login password</li>
                  <li>AUTH_TOTP_SECRET — TOTP secret (optional)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <SettingsIntegrations />
        </TabsContent>

        <TabsContent value="pdfa" className="mt-6">
          <SettingsPdfa />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  )
}
