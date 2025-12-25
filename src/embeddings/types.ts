/**
 * Embeddings provider interface
 * Implement this to use your own embedding provider
 */

export interface EmbeddingResult {
  /** The embedding vector */
  embedding: number[]
  /** Number of tokens used (if available) */
  tokenCount?: number
}

export interface EmbeddingsProvider {
  /**
   * Generate an embedding for a single text
   */
  embed(text: string): Promise<EmbeddingResult>
  
  /**
   * Generate embeddings for multiple texts (batch)
   * More efficient than calling embed() multiple times
   */
  embedBatch(texts: string[]): Promise<EmbeddingResult[]>
  
  /**
   * The dimension of the embedding vectors
   */
  readonly dimensions: number
}

/**
 * Configuration for embedding providers
 */
export interface EmbeddingsConfig {
  /** API key for the provider */
  apiKey?: string
  /** Model to use for embeddings */
  model?: string
  /** Base URL for API (for proxies or self-hosted) */
  baseURL?: string
  /** Maximum batch size for embedBatch */
  batchSize?: number
}

