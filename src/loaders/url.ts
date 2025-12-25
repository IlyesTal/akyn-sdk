/**
 * URL content loading utilities
 * Fetches and extracts text from web pages
 */

import { normalizeText, extractTextFromHTML, stripMarkdown } from '../processing/normalizer'

export interface FetchOptions {
  /**
   * Custom headers to send with the request
   */
  headers?: Record<string, string>
  
  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number
  
  /**
   * Custom user agent string
   */
  userAgent?: string
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Fetch and parse content from a URL
 */
export async function loadURL(url: string, options: FetchOptions = {}): Promise<string> {
  const {
    headers = {},
    timeout = 30000,
    userAgent = DEFAULT_USER_AGENT,
  } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain,text/markdown,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        ...headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || ''
    const text = await response.text()

    // Parse based on content type
    if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
      return extractTextFromHTML(text)
    }

    if (contentType.includes('text/markdown') || url.endsWith('.md')) {
      return stripMarkdown(text)
    }

    // Plain text or unknown - just normalize
    return normalizeText(text)
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Load multiple URLs in parallel
 */
export async function loadURLs(
  urls: string[],
  options: FetchOptions & { concurrency?: number } = {}
): Promise<Array<{ url: string; content: string; error?: string }>> {
  const { concurrency = 5, ...fetchOptions } = options
  const results: Array<{ url: string; content: string; error?: string }> = []
  
  // Process in batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        try {
          const content = await loadURL(url, fetchOptions)
          return { url, content }
        } catch (error) {
          return { 
            url, 
            content: '', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          }
        }
      })
    )
    results.push(...batchResults)
  }
  
  return results
}

/**
 * Validate if a string is a valid URL
 */
export function isValidURL(str: string): boolean {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

