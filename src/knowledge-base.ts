/**
 * KnowledgeBase - The main class of the SDK
 * 
 * A KnowledgeBase lets you:
 * 1. Add content from files, URLs, or raw text
 * 2. Query it with natural language
 * 3. Expose it as an MCP server
 */

import { chunkText, type ChunkOptions } from './processing'
import { loadFile, loadDirectory, loadURL } from './loaders'
import { OpenAIEmbeddings, type EmbeddingsProvider } from './embeddings'
import { InMemoryVectorStore, type VectorStore, type SearchResult } from './vectorstore'

export interface RetrievalOptions {
  /**
   * Maximum number of chunks to retrieve
   * @default 5
   */
  topK?: number
  
  /**
   * Minimum similarity score threshold (0-1)
   * Results below this threshold are filtered out
   * @default 0
   */
  threshold?: number
}

export interface KnowledgeBaseConfig {
  /**
   * Name of the knowledge base
   * Used in MCP server identification
   */
  name: string
  
  /**
   * Description of what this knowledge base contains
   */
  description?: string
  
  /**
   * Version string for the knowledge base
   * @default '1.0.0'
   */
  version?: string
  
  /**
   * Embeddings provider to use
   * @default OpenAIEmbeddings
   */
  embeddings?: EmbeddingsProvider
  
  /**
   * Vector store to use
   * @default InMemoryVectorStore
   */
  vectorStore?: VectorStore
  
  /**
   * Chunking options for text processing
   */
  chunking?: ChunkOptions
  
  /**
   * Retrieval options for querying
   * Configure how many results to return and similarity threshold
   */
  retrieval?: RetrievalOptions
}

export interface Source {
  /** Unique identifier for this source */
  id: string
  /** Human-readable name */
  name: string
  /** Type of source */
  type: 'file' | 'url' | 'text' | 'directory'
  /** Original path or URL */
  origin: string
  /** Number of chunks created from this source */
  chunkCount: number
  /** When this source was added */
  addedAt: Date
}

export interface QueryResult {
  /** The matched text chunk */
  text: string
  /** Similarity score (0-1) */
  score: number
  /** Source metadata */
  source?: {
    name: string
    type: string
  }
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

export class KnowledgeBase {
  private config: Required<Pick<KnowledgeBaseConfig, 'name' | 'version'>> & KnowledgeBaseConfig
  private embeddings: EmbeddingsProvider
  private vectorStore: VectorStore
  private sources: Map<string, Source> = new Map()
  private chunkOptions: ChunkOptions
  private retrievalOptions: Required<RetrievalOptions>

  constructor(config: KnowledgeBaseConfig) {
    if (!config.name) {
      throw new Error('Knowledge base name is required')
    }

    this.config = {
      ...config,
      version: config.version || '1.0.0',
    }

    this.embeddings = config.embeddings || new OpenAIEmbeddings()
    this.vectorStore = config.vectorStore || new InMemoryVectorStore()
    this.chunkOptions = config.chunking || {}
    this.retrievalOptions = {
      topK: config.retrieval?.topK ?? 5,
      threshold: config.retrieval?.threshold ?? 0,
    }
  }

  /**
   * Get knowledge base info
   */
  get info() {
    return {
      name: this.config.name,
      description: this.config.description,
      version: this.config.version,
      sourceCount: this.sources.size,
    }
  }

  /**
   * Generate a unique source ID
   */
  private generateSourceId(): string {
    return `src_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Add content and generate embeddings
   */
  private async addContent(
    content: string,
    metadata: { sourceName: string; sourceType: Source['type']; sourceOrigin: string }
  ): Promise<Source> {
    const sourceId = this.generateSourceId()
    const chunks = chunkText(content, this.chunkOptions)

    // Generate embeddings for all chunks
    const texts = chunks.map(c => c.text)
    const embeddingResults = await this.embeddings.embedBatch(texts)

    // Store in vector store
    const documents = chunks.map((chunk, i) => ({
      text: chunk.text,
      embedding: embeddingResults[i].embedding,
      metadata: {
        sourceId,
        sourceName: metadata.sourceName,
        sourceType: metadata.sourceType,
        chunkIndex: chunk.index,
      },
    }))

    await this.vectorStore.addBatch(documents)

    // Track the source
    const source: Source = {
      id: sourceId,
      name: metadata.sourceName,
      type: metadata.sourceType,
      origin: metadata.sourceOrigin,
      chunkCount: chunks.length,
      addedAt: new Date(),
    }

    this.sources.set(sourceId, source)
    return source
  }

  /**
   * Add raw text content
   */
  async addText(text: string, name?: string): Promise<Source> {
    const sourceName = name || `Text ${this.sources.size + 1}`
    return this.addContent(text, {
      sourceName,
      sourceType: 'text',
      sourceOrigin: 'inline',
    })
  }

  /**
   * Add a file (PDF, DOCX, TXT, MD)
   */
  async addFile(path: string, name?: string): Promise<Source> {
    const content = await loadFile(path)
    const sourceName = name || path.split('/').pop() || path
    
    return this.addContent(content, {
      sourceName,
      sourceType: 'file',
      sourceOrigin: path,
    })
  }

  /**
   * Add all files from a directory
   */
  async addDirectory(
    path: string,
    options?: { recursive?: boolean; extensions?: string[] }
  ): Promise<Source[]> {
    const files = await loadDirectory(path, options)
    const sources: Source[] = []

    for (const file of files) {
      const source = await this.addContent(file.content, {
        sourceName: file.path.split('/').pop() || file.path,
        sourceType: 'file',
        sourceOrigin: file.path,
      })
      sources.push(source)
    }

    return sources
  }

  /**
   * Add content from a URL
   */
  async addURL(url: string, name?: string): Promise<Source> {
    const content = await loadURL(url)
    const sourceName = name || new URL(url).hostname
    
    return this.addContent(content, {
      sourceName,
      sourceType: 'url',
      sourceOrigin: url,
    })
  }

  /**
   * Add multiple URLs
   */
  async addURLs(urls: string[]): Promise<Source[]> {
    const sources: Source[] = []
    
    for (const url of urls) {
      try {
        const source = await this.addURL(url)
        sources.push(source)
      } catch (error) {
        console.warn(`Failed to add URL ${url}:`, error)
      }
    }
    
    return sources
  }

  /**
   * Query the knowledge base
   */
  async query(
    question: string,
    options?: { topK?: number; threshold?: number }
  ): Promise<QueryResult[]> {
    const topK = options?.topK ?? this.retrievalOptions.topK
    const threshold = options?.threshold ?? this.retrievalOptions.threshold

    // Generate embedding for the question
    const { embedding } = await this.embeddings.embed(question)

    // Search the vector store
    const results = await this.vectorStore.search(embedding, { topK, threshold })

    // Format results
    return results.map((r: SearchResult) => ({
      text: r.text,
      score: r.score,
      source: r.metadata ? {
        name: r.metadata.sourceName as string,
        type: r.metadata.sourceType as string,
      } : undefined,
      metadata: r.metadata,
    }))
  }

  /**
   * List all sources
   */
  listSources(): Source[] {
    return Array.from(this.sources.values())
  }

  /**
   * Get source by ID
   */
  getSource(id: string): Source | undefined {
    return this.sources.get(id)
  }

  /**
   * Remove a source and its chunks
   */
  async removeSource(id: string): Promise<boolean> {
    const source = this.sources.get(id)
    if (!source) return false

    // Note: This requires iterating through all docs in memory store
    // For production, use a proper vector DB with metadata filtering
    this.sources.delete(id)
    return true
  }

  /**
   * Clear all content
   */
  async clear(): Promise<void> {
    await this.vectorStore.clear()
    this.sources.clear()
  }

  /**
   * Get document count
   */
  async getChunkCount(): Promise<number> {
    return this.vectorStore.count()
  }
}

