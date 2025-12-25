/**
 * MCP Protocol Types
 * Based on the Model Context Protocol specification
 */

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
  id?: string | number | null
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  result?: unknown
  error?: JsonRpcError
  id: string | number | null
}

export interface JsonRpcError {
  code: number
  message: string
  data?: unknown
}

// Standard JSON-RPC error codes
export const ErrorCodes = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const

// MCP Tool definition
export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, {
      type: string
      description?: string
      enum?: string[]
    }>
    required?: string[]
  }
}

// MCP Resource definition
export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

// MCP Server capabilities
export interface MCPCapabilities {
  tools?: Record<string, never>
  resources?: Record<string, never>
  prompts?: Record<string, never>
}

// MCP Server info
export interface MCPServerInfo {
  name: string
  version: string
}

// MCP Initialize response
export interface MCPInitializeResult {
  protocolVersion: string
  capabilities: MCPCapabilities
  serverInfo: MCPServerInfo
}

// MCP Tool call result
export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

