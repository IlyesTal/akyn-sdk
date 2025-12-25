/**
 * OpenAI Embeddings Provider
 * Uses OpenAI's text-embedding models
 */

import type { EmbeddingsProvider, EmbeddingResult, EmbeddingsConfig } from './types'

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings'

export interface OpenAIEmbeddingsConfig extends EmbeddingsConfig {
  /**
   * OpenAI model to use
   * @default 'text-embedding-3-large'
   */
  model?: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002' | string
}

// Model dimensions
const MODEL_DIMENSIONS: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
}

export class OpenAIEmbeddings implements EmbeddingsProvider {
  private apiKey: string
  private model: string
  private baseURL: string
  private batchSize: number
  public readonly dimensions: number

  constructor(config: OpenAIEmbeddingsConfig = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || ''
    this.model = config.model || 'text-embedding-3-large'
    this.baseURL = config.baseURL || OPENAI_API_URL
    this.batchSize = config.batchSize || 100
    this.dimensions = MODEL_DIMENSIONS[this.model] || 3072

    if (!this.apiKey) {
      throw new Error(
        'OpenAI API key is required. Pass it via config or set OPENAI_API_KEY environment variable.'
      )
    }
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(
        `OpenAI API error: ${errorBody.error?.message || response.statusText}`
      )
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>
      usage?: { total_tokens?: number }
    }
    
    return {
      embedding: data.data[0].embedding,
      tokenCount: data.usage?.total_tokens,
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = []

    // Process in batches
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize)
      
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: batch,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(
          `OpenAI API error: ${errorBody.error?.message || response.statusText}`
        )
      }

      const data = await response.json() as {
        data: Array<{ embedding: number[] }>
        usage?: { total_tokens?: number }
      }
      const tokensPerItem = Math.ceil((data.usage?.total_tokens || 0) / batch.length)
      
      for (const item of data.data) {
        results.push({
          embedding: item.embedding,
          tokenCount: tokensPerItem,
        })
      }

      // Small delay between batches to avoid rate limits
      if (i + this.batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return results
  }
}

