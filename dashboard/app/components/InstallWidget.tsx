"use client"

import { useState } from "react"
import Link from "next/link"

const commands = [
  { id: "npm", label: "Global Install", command: "npm i -g @agentlock/agent-lock" },
  { id: "install", label: "Install Plugin", command: "agent-lock install" },
  { id: "login", label: "Authenticate Base", command: "agent-lock login" },
  { id: "login-provider", label: "Connect Provider", command: "agent-lock login google" },
  { id: "scopes", label: "Manage Scopes", command: "agent-lock scopes" },
  { id: "status", label: "Check Status", command: "agent-lock status" }
]

export default function InstallWidget({ showDocumentationLink = true }: { showDocumentationLink?: boolean }) {
  const [selected, setSelected] = useState(commands[0])
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selected.command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      // Ignore
    }
  }

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto my-10">
      <div className="flex items-center w-full rounded-2xl border border-white/10 bg-[#161618] shadow-2xl relative">
        {/* Dropdown Section */}
        <div className="relative">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center justify-between gap-2 h-14 px-5 rounded-l-2xl bg-white text-black font-semibold text-sm hover:bg-gray-100 transition-colors"
          >
            {selected.label}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          
          {isOpen && (
            <div className="absolute top-full left-0 mt-2 w-48 rounded-xl border border-white/10 bg-[#1c1c1f] shadow-xl z-50 overflow-hidden">
              {commands.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => { setSelected(cmd); setIsOpen(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  {cmd.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Command Display Section */}
        <div className="flex-1 flex items-center justify-between px-6 h-14 bg-transparent overflow-hidden">
          <code className="text-[15px] font-mono text-gray-300 whitespace-nowrap overflow-x-auto hide-scrollbar">
            <span className="text-rose-400 mr-2">$</span>
            {selected.command}
          </code>
          
          <button 
            onClick={handleCopy}
            className="ml-4 flex items-center justify-center h-8 w-8 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex-shrink-0"
            title="Copy to clipboard"
          >
            {copied ? (
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <polyline points="20 6 9 17 4 12"></polyline>
               </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            )}
          </button>
        </div>
      </div>
      
      {showDocumentationLink && (
        <div className="mt-4">
          <span className="text-sm text-gray-500">
            Or read the{" "}
            <Link href="/learn" className="text-gray-400 underline decoration-gray-600 underline-offset-4 hover:text-white hover:decoration-rose-400 transition-colors">
              documentation
            </Link>
          </span>
        </div>
      )}
    </div>
  )
}
