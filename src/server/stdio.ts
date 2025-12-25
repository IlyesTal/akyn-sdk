/**
 * Stdio Transport for MCP
 * 
 * This transport reads JSON-RPC messages from stdin and writes responses to stdout.
 * Used by Claude Desktop and Cursor for local MCP servers.
 */

import * as readline from 'readline'
import type { KnowledgeBase } from '../knowledge-base'
import { MCPHandler } from './mcp-handler'
import type { JsonRpcRequest } from './types'

export interface StdioServerOptions {
  /**
   * Enable debug logging to stderr
   * @default false
   */
  debug?: boolean
}

/**
 * Start an MCP server using stdio transport
 * 
 * This is the main entry point for running as a local MCP server
 * with Claude Desktop or Cursor.
 */
export function serveStdio(
  knowledgeBase: KnowledgeBase,
  options: StdioServerOptions = {}
): void {
  const { debug = false } = options
  const handler = new MCPHandler(knowledgeBase)

  // Log to stderr (stdout is reserved for MCP messages)
  const log = (msg: string) => {
    if (debug) {
      process.stderr.write(`[akyn-mcp] ${msg}\n`)
    }
  }

  log(`Starting MCP server: ${knowledgeBase.info.name}`)

  // Set up readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  })

  // Handle incoming messages
  rl.on('line', async (line) => {
    if (!line.trim()) return

    try {
      const request = JSON.parse(line) as JsonRpcRequest
      log(`Request: ${request.method} (id: ${request.id ?? 'notification'})`)

      const response = await handler.handleRequest(request)

      // Only send response if there is one (notifications don't have responses)
      if (response) {
        log(`Response: ${response.error ? 'error' : 'success'}`)
        console.log(JSON.stringify(response))
      }
    } catch (error) {
      log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      
      // Try to extract request ID for error response
      try {
        const parsed = JSON.parse(line)
        if (parsed.id !== undefined && parsed.id !== null) {
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32700,
              message: error instanceof Error ? error.message : 'Parse error',
            },
            id: parsed.id,
          }))
        }
      } catch {
        // Can't parse, send generic error
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error' },
          id: null,
        }))
      }
    }
  })

  rl.on('close', () => {
    log('Connection closed')
    process.exit(0)
  })

  // Handle errors
  process.stdin.on('error', (err) => {
    log(`Stdin error: ${err.message}`)
    process.exit(1)
  })

  // Keep process alive
  process.stdin.resume()

  log('MCP server ready')
}

