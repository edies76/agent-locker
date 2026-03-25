// API caching and optimization utilities

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

class APICache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private defaultTTL: number = 5000 // 5 seconds default

  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now()
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + (ttl ?? this.defaultTTL),
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern)
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    // Clean expired entries first
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
    return this.cache.size
  }
}

export const apiCache = new APICache()

// Debounce utility
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

// Throttle utility
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// Request deduplication
const pendingRequests = new Map<string, Promise<any>>()

export async function dedupedFetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  // If request is already pending, return the same promise
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!
  }

  // Create new request
  const promise = fetcher().finally(() => {
    // Clean up when done
    pendingRequests.delete(key)
  })

  pendingRequests.set(key, promise)
  return promise
}

// Cached fetch with automatic deduplication
export async function cachedFetch<T>(
  url: string,
  options?: {
    ttl?: number
    skip?: boolean
    refresh?: boolean
  }
): Promise<T> {
  const cacheKey = `fetch:${url}`

  // Skip cache if requested
  if (options?.skip || options?.refresh) {
    if (options.refresh) {
      apiCache.invalidate(cacheKey)
    }
    
    return dedupedFetch(cacheKey, async () => {
      const response = await fetch(url, { cache: 'no-store' })
      const data = await response.json()
      
      if (response.ok) {
        apiCache.set(cacheKey, data, options?.ttl)
      }
      
      return data
    })
  }

  // Try cache first
  const cached = apiCache.get<T>(cacheKey)
  if (cached !== null) {
    return cached
  }

  // Fetch with deduplication
  return dedupedFetch(cacheKey, async () => {
    const response = await fetch(url, { cache: 'no-store' })
    const data = await response.json()
    
    if (response.ok) {
      apiCache.set(cacheKey, data, options?.ttl)
    }
    
    return data
  })
}

// Optimistic update helper
export function optimisticUpdate<T>(
  currentData: T,
  updater: (data: T) => T
): T {
  try {
    return updater(currentData)
  } catch (error) {
    console.error('Optimistic update failed:', error)
    return currentData
  }
}
