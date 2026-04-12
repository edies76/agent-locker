import type { Metadata } from "next"
import "./globals.css"
import ErrorBoundary from "./components/ErrorBoundary"
import { ToastProvider } from "./components/Toast"
import ClientProviders from "./components/ClientProviders"

export const metadata: Metadata = {
  title: "Agent-Lock Dashboard",
  description: "Security middleware dashboard for AI agent tool call interception",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head />
      <body className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)]" suppressHydrationWarning>
        <ErrorBoundary>
          <ToastProvider>
            <ClientProviders>
              {children}
            </ClientProviders>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
