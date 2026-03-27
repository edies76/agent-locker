'use client'

import { ThemeProvider } from "@/contexts/ThemeContext"
import Sidebar from "./Sidebar"

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider>
      <Sidebar />
      {children}
    </ThemeProvider>
  )
}
