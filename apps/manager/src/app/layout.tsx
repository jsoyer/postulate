import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/Sidebar"
import { Providers } from "@/components/Providers"
import { ThemeProvider } from "@/components/ThemeProvider"
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts"
import { CommandPalette } from "@/components/CommandPalette"
import { WebhookListener } from "@/components/WebhookListener"
import { BottomNav } from "@/components/BottomNav"
import { PwaRegister } from "@/components/PwaRegister"
import { Toaster } from "@/components/ui/sonner"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { UndoToastMount } from "@/components/UndoToastMount"
import { HealthBanner } from "@/components/HealthBanner"
import { LocalStorageMigration } from "@/components/LocalStorageMigration"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CV Manager",
  description: "Job application tracker",
  manifest: "/manifest.json",
}

export const viewport: Viewport = {
  themeColor: "#2563eb",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var s=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(!s&&d)){document.documentElement.classList.add('dark');}})();` }} />
      </head>
      <body className={`${inter.className} antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <Providers>
            <PwaRegister />
            <KeyboardShortcuts />
            <CommandPalette />
            <WebhookListener />
            <UndoToastMount />
            <Toaster />
            <HealthBanner />
            <LocalStorageMigration />
            <div className="flex h-screen">
              <Sidebar />
              <ErrorBoundary>
                <main id="main-content" className="flex-1 overflow-auto bg-background text-foreground pb-16 md:pb-0">
                  {children}
                </main>
              </ErrorBoundary>
            </div>
            <BottomNav />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
