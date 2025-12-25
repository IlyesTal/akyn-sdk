/**
 * @akyn/mcp-kb
 * 
 * Turn any data source into an MCP server in minutes.
 * 
 * @example
 * ```typescript
 * import { KnowledgeBase } from '@akyn/mcp-kb';
 * 
 * const kb = new KnowledgeBase({
 *   name: 'my-docs',
 *   description: 'My project documentation',
 * });
 * 
 * await kb.addDirectory('./docs');
 * await kb.addURL('https://docs.example.com');
 * 
 * // Serve as MCP server
 * kb.serveStdio(); // For Cursor/Claude Desktop
 * // or
 * kb.serveHttp({ port: 3000 }); // For HTTP clients
 * ```
 */

// Re-export KnowledgeBase with server methods
import {
  KnowledgeBase as KnowledgeBaseCore,
  type KnowledgeBaseConfig,
  type Source,
  type QueryResult,
} from './knowledge-base'

import { serveStdio, type StdioServerOptions } from './server/stdio'
import { serveHttp, type HttpServerOptions } from './server/http'

/**
 * Extended KnowledgeBase with server methods
 */
export class KnowledgeBase extends KnowledgeBaseCore {
  /**
   * Start an MCP server using stdio transport
   * 
   * Use this for Cursor and Claude Desktop integration.
   * 
   * @example
   * ```typescript
   * const kb = new KnowledgeBase({ name: 'my-docs' });
   * await kb.addDirectory('./docs');
   * kb.serveStdio();
   * ```
   */
  serveStdio(options?: StdioServerOptions): void {
    serveStdio(this, options)
  }

  /**
   * Start an MCP server using HTTP transport
   * 
   * Use this for web-based MCP clients or remote access.
   * 
   * @example
   * ```typescript
   * const kb = new KnowledgeBase({ name: 'my-docs' });
   * await kb.addDirectory('./docs');
   * await kb.serveHttp({ port: 3000 });
   * ```
   */
  serveHttp(options?: HttpServerOptions): ReturnType<typeof serveHttp> {
    return serveHttp(this, options)
  }
}

// Export types
export type { KnowledgeBaseConfig, Source, QueryResult }
export type { StdioServerOptions } from './server/stdio'
export type { HttpServerOptions } from './server/http'

// Export processing utilities
export {
  normalizeText,
  extractTextFromHTML,
  stripMarkdown,
  chunkText,
  estimateTokens,
  type ChunkOptions,
  type Chunk,
} from './processing'

// Export loaders
export {
  loadFile,
  loadDirectory,
  loadURL,
  loadURLs,
  parseFile,
  parsePDF,
  parseDOCX,
  parseTXT,
  parseMarkdown,
  detectFileType,
  isValidURL,
  type FileType,
  type FetchOptions,
} from './loaders'

// Export embeddings
export {
  OpenAIEmbeddings,
  cosineSimilarity,
  euclideanDistance,
  normalizeVector,
  type EmbeddingsProvider,
  type EmbeddingResult,
  type EmbeddingsConfig,
  type OpenAIEmbeddingsConfig,
} from './embeddings'

// Export vector store
export {
  InMemoryVectorStore,
  type VectorStore,
  type StoredDocument,
  type SearchResult,
  type InMemoryVectorStoreConfig,
} from './vectorstore'

// Export server utilities
export {
  MCPHandler,
  serveStdio,
  serveHttp,
  createHttpServer,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type MCPTool,
  type MCPResource,
} from './server'

