/**
 * Vector store interface
 * Implement this to use your own vector database (Qdrant, Pinecone, etc.)
 */

export interface StoredDocument {
  /** Unique identifier */
  id: string
  /** The text content */
  text: string
  /** The embedding vector */
  embedding: number[]
  /** Optional metadata */
  metadata?: Record<string, unknown>
}

export interface SearchResult {
  /** Document ID */
  id: string
  /** The text content */
  text: string
  /** Similarity score (0-1, higher is more similar) */
  score: number
  /** Document metadata */
  metadata?: Record<string, unknown>
}

export interface VectorStore {
  /**
   * Add a document to the store
   */
  add(document: Omit<StoredDocument, 'id'>): Promise<string>
  
  /**
   * Add multiple documents to the store
   */
  addBatch(documents: Array<Omit<StoredDocument, 'id'>>): Promise<string[]>
  
  /**
   * Search for similar documents
   */
  search(
    queryEmbedding: number[],
    options?: {
      topK?: number
      threshold?: number
      filter?: Record<string, unknown>
    }
  ): Promise<SearchResult[]>
  
  /**
   * Delete a document by ID
   */
  delete(id: string): Promise<void>
  
  /**
   * Delete all documents
   */
  clear(): Promise<void>
  
  /**
   * Get the number of documents in the store
   */
  count(): Promise<number>
}

