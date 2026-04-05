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
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="min-h-screen">
        <ErrorBoundary>
          <ToastProvider>
            <ClientProviders>
              <main className="min-h-screen transition-all duration-200 md:ml-56">
                <div className="app-shell-container px-4 pb-6 pt-16 md:p-6 max-w-screen-xl mx-auto animate-fade-in">
                  <ErrorBoundary>{children}</ErrorBoundary>
                </div>
              </main>
            </ClientProviders>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
