/**
 * MCP Protocol Handler
 * Implements the Model Context Protocol (MCP) JSON-RPC interface
 */

import type { KnowledgeBase } from '../knowledge-base'
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  MCPTool,
  MCPResource,
  MCPInitializeResult,
  MCPToolResult,
} from './types'
import { ErrorCodes } from './types'

// MCP Protocol version
const PROTOCOL_VERSION = '2024-11-05'

export class MCPHandler {
  private kb: KnowledgeBase

  constructor(knowledgeBase: KnowledgeBase) {
    this.kb = knowledgeBase
  }

  /**
   * Handle a JSON-RPC request
   */
  async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    const { method, params, id } = request

    // Notifications (no id) don't need responses for certain methods
    const isNotification = id === undefined || id === null
    const notificationMethods = ['initialized', 'notifications/cancelled', 'notifications/progress']
    
    if (isNotification && notificationMethods.includes(method)) {
      // Handle notification silently
      return null
    }

    try {
      const result = await this.routeMethod(method, params)
      return this.success(id ?? null, result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal error'
      const code = message.includes('not found') ? ErrorCodes.MethodNotFound : ErrorCodes.InternalError
      return this.error(id ?? null, code, message)
    }
  }

  /**
   * Route method to appropriate handler
   */
  private async routeMethod(
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    switch (method) {
      case 'initialize':
        return this.handleInitialize()

      case 'initialized':
        return {}

      case 'ping':
        return {}

      case 'tools/list':
        return this.handleToolsList()

      case 'tools/call':
        return this.handleToolCall(params)

      case 'resources/list':
        return this.handleResourcesList()

      case 'resources/read':
        return this.handleResourceRead(params)

      case 'prompts/list':
        return { prompts: [] }

      case 'completion/complete':
        return { completion: { values: [] } }

      default:
        throw new Error(`Method not found: ${method}`)
    }
  }

  /**
   * Handle initialize request
   */
  private handleInitialize(): MCPInitializeResult {
    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {
        tools: {},
        resources: {},
      },
      serverInfo: {
        name: `akyn-kb-${this.kb.info.name}`,
        version: this.kb.info.version,
      },
    }
  }

  /**
   * Handle tools/list request
   */
  private handleToolsList(): { tools: MCPTool[] } {
    const kbName = this.kb.info.name
    const kbDescription = this.kb.info.description || `the "${kbName}" knowledge base`

    return {
      tools: [
        {
          name: 'query',
          description: `Query ${kbDescription} with a natural language question. Returns relevant context chunks from the indexed content.`,
          inputSchema: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: 'The question to search for in the knowledge base',
              },
              max_results: {
                type: 'number',
                description: 'Maximum number of results to return (default: 5)',
              },
            },
            required: ['question'],
          },
        },
        {
          name: 'list_sources',
          description: `List all sources (documents, URLs) indexed in ${kbDescription}`,
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }
  }

  /**
   * Handle tools/call request
   */
  private async handleToolCall(
    params?: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const toolName = params?.name as string
    const args = (params?.arguments || {}) as Record<string, unknown>

    switch (toolName) {
      case 'query':
        return this.executeQuery(args)

      case 'list_sources':
        return this.executeListSources()

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
          isError: true,
        }
    }
  }

  /**
   * Execute query tool
   */
  private async executeQuery(args: Record<string, unknown>): Promise<MCPToolResult> {
    const question = args.question as string
    const maxResults = (args.max_results as number) || 5

    if (!question) {
      return {
        content: [{ type: 'text', text: 'Error: question is required' }],
        isError: true,
      }
    }

    try {
      const results = await this.kb.query(question, { topK: maxResults })

      if (results.length === 0) {
        return {
          content: [{ type: 'text', text: 'No relevant results found for your query.' }],
        }
      }

      const formattedResults = results
        .map((r, i) => {
          const sourceInfo = r.source ? ` (from: ${r.source.name})` : ''
          return `[${i + 1}] (score: ${r.score.toFixed(3)})${sourceInfo}\n${r.text}`
        })
        .join('\n\n---\n\n')

      return {
        content: [
          {
            type: 'text',
            text: `Found ${results.length} relevant results:\n\n${formattedResults}`,
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Query failed'}`,
          },
        ],
        isError: true,
      }
    }
  }

  /**
   * Execute list_sources tool
   */
  private executeListSources(): MCPToolResult {
    const sources = this.kb.listSources()

    if (sources.length === 0) {
      return {
        content: [{ type: 'text', text: 'No sources found in this knowledge base.' }],
      }
    }

    const formatted = sources
      .map(s => `- ${s.name} (${s.type}) [${s.chunkCount} chunks]`)
      .join('\n')

    return {
      content: [
        {
          type: 'text',
          text: `Sources in "${this.kb.info.name}":\n\n${formatted}`,
        },
      ],
    }
  }

  /**
   * Handle resources/list request
   */
  private handleResourcesList(): { resources: MCPResource[] } {
    return {
      resources: [
        {
          uri: `kb://info`,
          name: 'Knowledge Base Info',
          description: `Information about the "${this.kb.info.name}" knowledge base`,
          mimeType: 'application/json',
        },
      ],
    }
  }

  /**
   * Handle resources/read request
   */
  private handleResourceRead(params?: Record<string, unknown>): {
    contents: Array<{ uri: string; mimeType: string; text: string }>
  } {
    const uri = params?.uri as string

    if (uri === 'kb://info') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(this.kb.info, null, 2),
          },
        ],
      }
    }

    throw new Error(`Resource not found: ${uri}`)
  }

  /**
   * Create success response
   */
  private success(id: string | number | null, result: unknown): JsonRpcResponse {
    return { jsonrpc: '2.0', result, id }
  }

  /**
   * Create error response
   */
  private error(
    id: string | number | null,
    code: number,
    message: string
  ): JsonRpcResponse {
    return { jsonrpc: '2.0', error: { code, message }, id }
  }
}

