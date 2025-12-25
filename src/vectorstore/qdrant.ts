/**
 * Qdrant Vector Store
 * 
 * Zero-dependency Qdrant adapter using the REST API.
 * Works with both local Docker instances and Qdrant Cloud.
 * 
 * Quick start:
 *   docker run -p 6333:6333 qdrant/qdrant
 */

import type { VectorStore, StoredDocument, SearchResult } from './types'

export interface QdrantVectorStoreConfig {
  /**
   * Qdrant server URL
   * @default 'http://localhost:6333'
   */
  url?: string

  /**
   * API key for Qdrant Cloud
   * Not needed for local Docker instances
   */
  apiKey?: string

  /**
   * Collection name to use
   * @default 'akyn_documents'
   */
  collection?: string

  /**
   * Vector dimensions
   * Auto-detected from first document if not specified
   */
  dimensions?: number
}

export class QdrantVectorStore implements VectorStore {
  private url: string
  private apiKey?: string
  private collection: string
  private dimensions?: number
  private initialized = false

  constructor(config: QdrantVectorStoreConfig = {}) {
    this.url = config.url || 'http://localhost:6333'
    this.apiKey = config.apiKey
    this.collection = config.collection || 'akyn_documents'
    this.dimensions = config.dimensions
  }

  /**
   * Get headers for Qdrant API requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.apiKey) {
      headers['api-key'] = this.apiKey
    }
    return headers
  }

  /**
   * Make a request to the Qdrant API
   */
  private async request<T>(
    path: string,
    options: {
      method?: string
      body?: unknown
    } = {}
  ): Promise<T> {
    const { method = 'GET', body } = options

    try {
      const response = await fetch(`${this.url}${path}`, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Qdrant API error: ${response.status} - ${error}`)
      }

      return response.json() as T
    } catch (error) {
      // Provide helpful error message if Qdrant isn't running
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          `\n╭─────────────────────────────────────────────────────────╮\n` +
          `│  Could not connect to Qdrant at ${this.url}        │\n` +
          `│                                                         │\n` +
          `│  Start Qdrant with Docker:                              │\n` +
          `│  docker run -p 6333:6333 qdrant/qdrant                  │\n` +
          `│                                                         │\n` +
          `│  Or use Qdrant Cloud: https://cloud.qdrant.io           │\n` +
          `╰─────────────────────────────────────────────────────────╯\n`
        )
      }
      throw error
    }
  }

  /**
   * Ensure the collection exists, create if needed
   */
  private async ensureCollection(dimensions: number): Promise<void> {
    if (this.initialized) return

    // Check if collection exists
    const collections = await this.request<{
      result: { collections: Array<{ name: string }> }
    }>('/collections')

    const exists = collections.result.collections.some(
      (c) => c.name === this.collection
    )

    if (!exists) {
      // Create collection with cosine similarity
      await this.request(`/collections/${this.collection}`, {
        method: 'PUT',
        body: {
          vectors: {
            size: dimensions,
            distance: 'Cosine',
          },
        },
      })
    }

    this.dimensions = dimensions
    this.initialized = true
  }

  /**
   * Generate a UUID for Qdrant point ID
   * Qdrant only accepts unsigned integers or UUIDs
   */
  private generateId(): string {
    // Use crypto.randomUUID() if available (Node 15.6+, modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    // Fallback: generate UUID v4 manually
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  async add(document: Omit<StoredDocument, 'id'>): Promise<string> {
    await this.ensureCollection(document.embedding.length)

    const id = this.generateId()

    await this.request(`/collections/${this.collection}/points`, {
      method: 'PUT',
      body: {
        points: [
          {
            id,
            vector: document.embedding,
            payload: {
              text: document.text,
              ...document.metadata,
            },
          },
        ],
      },
    })

    return id
  }

  async addBatch(documents: Array<Omit<StoredDocument, 'id'>>): Promise<string[]> {
    if (documents.length === 0) return []

    await this.ensureCollection(documents[0].embedding.length)

    const ids = documents.map(() => this.generateId())

    const points = documents.map((doc, i) => ({
      id: ids[i],
      vector: doc.embedding,
      payload: {
        text: doc.text,
        ...doc.metadata,
      },
    }))

    await this.request(`/collections/${this.collection}/points`, {
      method: 'PUT',
      body: { points },
    })

    return ids
  }

  async search(
    queryEmbedding: number[],
    options: {
      topK?: number
      threshold?: number
      filter?: Record<string, unknown>
    } = {}
  ): Promise<SearchResult[]> {
    const { topK = 5, threshold = 0.0, filter } = options

    // Build Qdrant filter from simple key-value filter
    const qdrantFilter = filter && Object.keys(filter).length > 0
      ? {
          must: Object.entries(filter).map(([key, value]) => ({
            key,
            match: { value },
          })),
        }
      : undefined

    const searchBody: Record<string, unknown> = {
      vector: queryEmbedding,
      limit: topK,
      score_threshold: threshold,
      with_payload: true,
    }
    
    if (qdrantFilter) {
      searchBody.filter = qdrantFilter
    }

    const response = await this.request<{
      result: Array<{
        id: string
        score: number
        payload: Record<string, unknown>
      }>
    }>(`/collections/${this.collection}/points/search`, {
      method: 'POST',
      body: searchBody,
    })

    return response.result.map((hit) => {
      const { text, ...metadata } = hit.payload
      return {
        id: String(hit.id),
        text: text as string,
        score: hit.score,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      }
    })
  }

  async delete(id: string): Promise<void> {
    await this.request(`/collections/${this.collection}/points/delete`, {
      method: 'POST',
      body: {
        points: [id],
      },
    })
  }

  async clear(): Promise<void> {
    // Delete the collection entirely
    try {
      await this.request(`/collections/${this.collection}`, {
        method: 'DELETE',
      })
    } catch {
      // Collection might not exist, that's fine
    }
    this.initialized = false
  }

  async count(): Promise<number> {
    try {
      const response = await this.request<{
        result: { points_count: number }
      }>(`/collections/${this.collection}`)
      return response.result.points_count
    } catch {
      return 0
    }
  }

  /**
   * Check if Qdrant is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request('/healthz')
      return true
    } catch {
      return false
    }
  }
}

