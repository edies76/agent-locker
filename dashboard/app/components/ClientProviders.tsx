'use client'

import { useEffect, useRef, useState } from "react"
import { ThemeProvider } from "@/contexts/ThemeContext"
import Sidebar from "./Sidebar"
import AIAssistantWidget from "./AIAssistantWidget"
import { useToast } from "./Toast"
import {
  getBackendConnectionInfo,
} from "@/lib/api"
import { BackendResolution } from "@/lib/backendEndpoint"

function BackendConnectionNotice() {
  const { showToast } = useToast()
  const [resolution, setResolution] = useState<BackendResolution | null>(null)
  const lastSourceRef = useRef<"local" | "cloud" | null>(null)

  useEffect(() => {
    let mounted = true

    const handleResolution = (res: BackendResolution) => {
      setResolution(res)
      if (lastSourceRef.current === res.source) return

      lastSourceRef.current = res.source

      if (res.source === "cloud") {
        showToast({
          type: "warning",
          title: "Backend local no disponible",
          message: "Conectado a la nube (Azure) como fallback.",
          duration: 7000,
        })
      }

      if (res.source === "local") {
        showToast({
          type: "success",
          title: "Backend local activo",
          message: "Se restauro la conexion local con prioridad.",
          duration: 4000,
        })
      }
    }

    const onResolutionEvent = (event: Event) => {
      const customEvent = event as CustomEvent<BackendResolution>
      handleResolution(customEvent.detail)
    }

    void getBackendConnectionInfo().then((res) => {
      if (!mounted || !res) return
      handleResolution(res)
    })

    window.addEventListener("agent-lock-backend-resolution", onResolutionEvent)
    return () => {
      mounted = false
      window.removeEventListener("agent-lock-backend-resolution", onResolutionEvent)
    }
  }, [showToast])

  if (!resolution || resolution.source !== "cloud") return null

  return (
    <div className="fixed top-4 right-4 z-40 rounded-md border border-amber-700/40 bg-amber-950/90 px-3 py-2 text-xs text-amber-100 shadow-lg backdrop-blur-sm">
      Modo fallback: conectado al backend en la nube.
    </div>
  )
}

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider>
      <BackendConnectionNotice />
      <Sidebar />
      <AIAssistantWidget />
      {children}
    </ThemeProvider>
  )
}
