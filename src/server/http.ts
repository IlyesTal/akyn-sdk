/**
 * HTTP Transport for MCP
 * 
 * This transport serves MCP over HTTP with SSE support.
 * Can be used standalone or integrated into existing web servers.
 */

import * as http from 'http'
import type { KnowledgeBase } from '../knowledge-base'
import { MCPHandler } from './mcp-handler'
import type { JsonRpcRequest, JsonRpcResponse } from './types'

export interface HttpServerOptions {
  /**
   * Port to listen on
   * @default 3000
   */
  port?: number

  /**
   * Host to bind to
   * @default '0.0.0.0'
   */
  host?: string

  /**
   * Enable CORS headers
   * @default true
   */
  cors?: boolean

  /**
   * Custom CORS origin
   * @default '*'
   */
  corsOrigin?: string

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, Accept',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
}

/**
 * Create an HTTP server for MCP
 */
export function createHttpServer(
  knowledgeBase: KnowledgeBase,
  options: HttpServerOptions = {}
): http.Server {
  const {
    cors = true,
    corsOrigin = '*',
    debug = false,
  } = options

  const handler = new MCPHandler(knowledgeBase)

  const log = (msg: string) => {
    if (debug) {
      console.log(`[akyn-mcp] ${msg}`)
    }
  }

  const getCorsHeaders = () => {
    if (!cors) return {}
    return {
      ...CORS_HEADERS,
      'Access-Control-Allow-Origin': corsOrigin,
    }
  }

  const server = http.createServer(async (req, res) => {
    const corsHeaders = getCorsHeaders()

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders)
      res.end()
      return
    }

    // Handle SSE connection (for MCP transport)
    if (req.method === 'GET' && req.headers.accept?.includes('text/event-stream')) {
      log('SSE connection established')
      
      const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...corsHeaders,
      }

      res.writeHead(200, headers)

      // Send endpoint event (tells client where to POST)
      const host = req.headers.host || 'localhost:3000'
      const protocol = req.headers['x-forwarded-proto'] || 'http'
      const endpoint = `${protocol}://${host}`
      
      res.write(`event: endpoint\ndata: ${endpoint}\n\n`)

      // Keep-alive pings
      const keepAlive = setInterval(() => {
        try {
          res.write(`: ping\n\n`)
        } catch {
          clearInterval(keepAlive)
        }
      }, 15000)

      req.on('close', () => {
        log('SSE connection closed')
        clearInterval(keepAlive)
      })

      return
    }

    // Handle GET request for server info
    if (req.method === 'GET') {
      const info = {
        name: knowledgeBase.info.name,
        version: knowledgeBase.info.version,
        description: knowledgeBase.info.description,
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
        },
      }

      res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders })
      res.end(JSON.stringify(info))
      return
    }

    // Handle POST request for JSON-RPC
    if (req.method === 'POST') {
      // Get or create session ID
      const incomingSessionId = req.headers['mcp-session-id'] as string
      const sessionId = incomingSessionId || crypto.randomUUID()

      let body = ''
      
      req.on('data', chunk => {
        body += chunk.toString()
      })

      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body) as JsonRpcRequest | JsonRpcRequest[]
          const requests = Array.isArray(parsed) ? parsed : [parsed]
          const responses: JsonRpcResponse[] = []

          for (const request of requests) {
            log(`Request: ${request.method} (id: ${request.id ?? 'notification'})`)
            
            const response = await handler.handleRequest(request)
            if (response) {
              responses.push(response)
            }
          }

          // If all were notifications, return 202 Accepted
          if (responses.length === 0) {
            res.writeHead(202, { 'Mcp-Session-Id': sessionId, ...corsHeaders })
            res.end()
            return
          }

          // Return response(s)
          const responseBody = Array.isArray(parsed) ? responses : responses[0]
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
            ...corsHeaders,
          })
          res.end(JSON.stringify(responseBody))
        } catch (error) {
          log(`Error: ${error instanceof Error ? error.message : 'Unknown'}`)
          
          res.writeHead(400, {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
            ...corsHeaders,
          })
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32700, message: 'Parse error' },
            id: null,
          }))
        }
      })

      return
    }

    // Method not allowed
    res.writeHead(405, corsHeaders)
    res.end('Method not allowed')
  })

  return server
}

/**
 * Start an HTTP MCP server
 */
export function serveHttp(
  knowledgeBase: KnowledgeBase,
  options: HttpServerOptions = {}
): Promise<http.Server> {
  const { port = 3000, host = '0.0.0.0' } = options
  const server = createHttpServer(knowledgeBase, options)

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(port, host, () => {
      console.log(`🚀 MCP server "${knowledgeBase.info.name}" running at http://${host}:${port}`)
      resolve(server)
    })
  })
}

