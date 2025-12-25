/**
 * In-Memory Vector Store
 * Simple, fast, and requires no external dependencies
 * Best for small to medium knowledge bases (< 100k documents)
 */

import { cosineSimilarity } from '../embeddings/utils'
import type { VectorStore, StoredDocument, SearchResult } from './types'

export interface InMemoryVectorStoreConfig {
  /**
   * Optional path to persist the store to disk
   * If provided, the store will save/load from this file
   */
  persistPath?: string
}

export class InMemoryVectorStore implements VectorStore {
  private documents: Map<string, StoredDocument> = new Map()
  private persistPath?: string

  constructor(config: InMemoryVectorStoreConfig = {}) {
    this.persistPath = config.persistPath
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  async add(document: Omit<StoredDocument, 'id'>): Promise<string> {
    const id = this.generateId()
    this.documents.set(id, { ...document, id })
    await this.maybePersist()
    return id
  }

  async addBatch(documents: Array<Omit<StoredDocument, 'id'>>): Promise<string[]> {
    const ids: string[] = []
    
    for (const doc of documents) {
      const id = this.generateId()
      this.documents.set(id, { ...doc, id })
      ids.push(id)
    }
    
    await this.maybePersist()
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

    const results: SearchResult[] = []

    for (const doc of this.documents.values()) {
      // Apply filter if provided
      if (filter && !this.matchesFilter(doc.metadata || {}, filter)) {
        continue
      }

      const score = cosineSimilarity(queryEmbedding, doc.embedding)
      
      if (score >= threshold) {
        results.push({
          id: doc.id,
          text: doc.text,
          score,
          metadata: doc.metadata,
        })
      }
    }

    // Sort by score descending and take top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  async delete(id: string): Promise<void> {
    this.documents.delete(id)
    await this.maybePersist()
  }

  async clear(): Promise<void> {
    this.documents.clear()
    await this.maybePersist()
  }

  async count(): Promise<number> {
    return this.documents.size
  }

  /**
   * Check if metadata matches a filter
   */
  private matchesFilter(
    metadata: Record<string, unknown>,
    filter: Record<string, unknown>
  ): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (metadata[key] !== value) {
        return false
      }
    }
    return true
  }

  /**
   * Persist to disk if persistPath is set
   */
  private async maybePersist(): Promise<void> {
    if (!this.persistPath) return

    const fs = await import('fs/promises')
    const data = JSON.stringify(Array.from(this.documents.entries()))
    await fs.writeFile(this.persistPath, data, 'utf-8')
  }

  /**
   * Load from disk if persistPath exists
   */
  async load(): Promise<void> {
    if (!this.persistPath) return

    try {
      const fs = await import('fs/promises')
      const data = await fs.readFile(this.persistPath, 'utf-8')
      const entries = JSON.parse(data) as [string, StoredDocument][]
      this.documents = new Map(entries)
    } catch {
      // File doesn't exist yet, start fresh
    }
  }

  /**
   * Get all documents (useful for debugging)
   */
  getAll(): StoredDocument[] {
    return Array.from(this.documents.values())
  }

  /**
   * Export the store data for backup
   */
  export(): StoredDocument[] {
    return Array.from(this.documents.values())
  }

  /**
   * Import data from a backup
   */
  import(documents: StoredDocument[]): void {
    for (const doc of documents) {
      this.documents.set(doc.id, doc)
    }
  }
}

