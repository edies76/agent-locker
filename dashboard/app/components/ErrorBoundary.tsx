"use client"

import { Component, ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-8 max-w-2xl w-full">
            <div className="flex items-start gap-4">
              <span className="text-4xl">⚠️</span>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-red-300 mb-2">
                  Something went wrong
                </h2>
                <p className="text-red-400 text-sm mb-4">
                  An unexpected error occurred while rendering this component.
                </p>
                {this.state.error && (
                  <details className="mb-4">
                    <summary className="text-xs text-red-500 cursor-pointer hover:text-red-400 mb-2">
                      Error details
                    </summary>
                    <pre className="text-xs text-red-300 bg-red-950/40 border border-red-800/40 rounded-lg p-3 overflow-auto max-h-48 font-mono">
                      {this.state.error.message}
                      {"\n\n"}
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
                <button
                  onClick={() => {
                    this.setState({ hasError: false, error: null })
                    window.location.reload()
                  }}
                  className="bg-red-700 hover:bg-red-600 text-white font-semibold text-sm rounded-lg px-4 py-2 transition-colors"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
