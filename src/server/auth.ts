/**
 * Simple Authentication for HTTP server
 */

import type * as http from 'http'

export interface AuthResult {
  authenticated: boolean
  userId?: string
  error?: string
}

export type AuthHandler = (req: http.IncomingMessage) => Promise<AuthResult> | AuthResult

export interface BearerAuthConfig {
  type: 'bearer'
  /** Token or tokens to validate against */
  token: string | string[]
}

export interface OAuthConfig {
  type: 'oauth'
  /** Token introspection endpoint */
  introspectionUrl: string
  /** Client credentials for introspection (optional) */
  clientId?: string
  clientSecret?: string
}

export type AuthConfig = BearerAuthConfig | OAuthConfig | AuthHandler

/**
 * Resolve auth config to a handler function
 */
export function resolveAuthHandler(config: AuthConfig): AuthHandler {
  if (typeof config === 'function') {
    return config
  }

  if (config.type === 'bearer') {
    return createBearerHandler(config)
  }

  return createOAuthHandler(config)
}

function createBearerHandler(config: BearerAuthConfig): AuthHandler {
  const validTokens = Array.isArray(config.token) ? config.token : [config.token]

  return (req) => {
    const authHeader = req.headers['authorization']

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authenticated: false, error: 'Missing or invalid Authorization header' }
    }

    const token = authHeader.slice(7)

    if (!validTokens.includes(token)) {
      return { authenticated: false, error: 'Invalid token' }
    }

    return { authenticated: true }
  }
}

function createOAuthHandler(config: OAuthConfig): AuthHandler {
  return async (req) => {
    const authHeader = req.headers['authorization']

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authenticated: false, error: 'Missing or invalid Authorization header' }
    }

    const token = authHeader.slice(7)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      }

      // Add client credentials if provided
      if (config.clientId && config.clientSecret) {
        const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
        headers['Authorization'] = `Basic ${credentials}`
      }

      const response = await fetch(config.introspectionUrl, {
        method: 'POST',
        headers,
        body: `token=${encodeURIComponent(token)}`,
      })

      if (!response.ok) {
        return { authenticated: false, error: 'Introspection request failed' }
      }

      const data = await response.json() as { active?: boolean; sub?: string }

      if (!data.active) {
        return { authenticated: false, error: 'Token is not active' }
      }

      return { authenticated: true, userId: data.sub }
    } catch {
      return { authenticated: false, error: 'Token validation failed' }
    }
  }
}

