'use client'

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { ThemeProvider } from "@/contexts/ThemeContext"
import Sidebar from "./Sidebar"

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isLandingPage = pathname === "/"

  useEffect(() => {
    if (isLandingPage) {
      document.body.classList.add("landing-no-sidebar")
    } else {
      document.body.classList.remove("landing-no-sidebar")
    }

    return () => {
      document.body.classList.remove("landing-no-sidebar")
    }
  }, [isLandingPage])

  return (
    <ThemeProvider>
      {!isLandingPage && <Sidebar />}
      {children}
    </ThemeProvider>
  )
}
