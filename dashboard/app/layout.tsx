import type { Metadata } from "next"
import "./globals.css"
import Sidebar from "./components/Sidebar"

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
      <body className="bg-brand-bg text-slate-200 min-h-screen">
        <Sidebar />
        <main className="ml-60 min-h-screen">
          <div className="p-6 max-w-screen-2xl mx-auto">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
