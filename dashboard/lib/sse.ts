// Server-Sent Events (SSE) client for real-time updates

type SSEEvent = {
  type: string
  data: any
}

type SSEHandler = (data: any) => void

class SSEClient {
  private eventSource: EventSource | null = null
  private handlers: Map<string, Set<SSEHandler>> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  connect(url: string = 'https://agent-lock-backend-api-7.azurewebsites.net/events/stream') {
    if (this.eventSource) {
      console.warn('SSE already connected')
      return
    }

    console.log('🔌 Connecting to SSE stream...')
    this.eventSource = new EventSource(url)

    this.eventSource.onopen = () => {
      console.log('✅ SSE connected')
      this.reconnectAttempts = 0
    }

    this.eventSource.onerror = (error) => {
      console.error('❌ SSE error:', error)
      this.eventSource?.close()
      this.eventSource = null

      // Attempt reconnection with exponential backoff
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
        setTimeout(() => this.connect(url), delay)
      } else {
        console.error('💥 Max reconnection attempts reached')
      }
    }

    // Register listeners for all event types
    this.eventSource.addEventListener('connected', (e) => {
      this.handleEvent('connected', e)
    })

    this.eventSource.addEventListener('ping', (e) => {
      this.handleEvent('ping', e)
    })

    this.eventSource.addEventListener('approval_pending', (e) => {
      this.handleEvent('approval_pending', e)
    })

    this.eventSource.addEventListener('approval_decided', (e) => {
      this.handleEvent('approval_decided', e)
    })

    this.eventSource.addEventListener('mcp_connected', (e) => {
      this.handleEvent('mcp_connected', e)
    })

    this.eventSource.addEventListener('mcp_disconnected', (e) => {
      this.handleEvent('mcp_disconnected', e)
    })

    this.eventSource.addEventListener('stats_updated', (e) => {
      this.handleEvent('stats_updated', e)
    })
  }

  private handleEvent(eventType: string, event: MessageEvent) {
    try {
      const data = JSON.parse(event.data)
      const handlers = this.handlers.get(eventType)
      
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(data)
          } catch (error) {
            console.error(`Error in SSE handler for ${eventType}:`, error)
          }
        })
      }
    } catch (error) {
      console.error(`Failed to parse SSE event data for ${eventType}:`, error)
    }
  }

  on(eventType: string, handler: SSEHandler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }
    this.handlers.get(eventType)!.add(handler)
  }

  off(eventType: string, handler: SSEHandler) {
    const handlers = this.handlers.get(eventType)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  disconnect() {
    if (this.eventSource) {
      console.log('🔌 Disconnecting SSE...')
      this.eventSource.close()
      this.eventSource = null
    }
    this.handlers.clear()
    this.reconnectAttempts = 0
  }

  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN
  }
}

export const sseClient = new SSEClient()

// Auto-connect when in browser
if (typeof window !== 'undefined') {
  // Wait a bit for initial page load
  setTimeout(() => {
    sseClient.connect()
  }, 1000)
}
