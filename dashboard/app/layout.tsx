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
      <head>
        {/* Prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const stored = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const theme = stored === 'dark' || (stored === 'system' && prefersDark) || (!stored && prefersDark) ? 'dark' : 'light';
                if (theme === 'dark') document.documentElement.classList.add('dark');
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen">
        <ErrorBoundary>
          <ToastProvider>
            <ClientProviders>
              <main className="ml-56 min-h-screen transition-all duration-200">
                <div className="p-6 max-w-screen-xl mx-auto animate-fade-in">
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
