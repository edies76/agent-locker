import type { Metadata } from "next"
import "./globals.css"
import Sidebar from "./components/Sidebar"
import ErrorBoundary from "./components/ErrorBoundary"
import { ToastProvider } from "./components/Toast"

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
    <html lang="en">
      <body className="bg-brand-bg text-slate-200 min-h-screen relative overflow-x-hidden">
        <ErrorBoundary>
          <ToastProvider>
            <div className="blur-orb w-64 h-64 bg-sky-400/20 -left-16 top-16" />
            <div className="blur-orb w-72 h-72 bg-amber-300/20 right-10 top-40" />
            <div className="blur-orb w-80 h-80 bg-cyan-300/20 right-28 bottom-10" />
            <Sidebar />
            <main className="ml-60 min-h-screen relative z-10">
              <div className="p-6 max-w-screen-2xl mx-auto fade-up">
                <ErrorBoundary>{children}</ErrorBoundary>
              </div>
            </main>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
