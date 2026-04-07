import Sidebar from "../components/Sidebar"
import ErrorBoundary from "../components/ErrorBoundary"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Sidebar />
      <main className="min-h-screen transition-all duration-200 md:ml-[15.4rem]">
        <div className="app-shell-container px-4 pb-6 pt-16 md:p-6 max-w-screen-xl mx-auto animate-fade-in">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
    </>
  )
}
