/**
 * Custom Embeddings Example
 * 
 * Use your own embeddings provider (e.g., local model, different API)
 */

import { KnowledgeBase, type EmbeddingsProvider, type EmbeddingResult } from 'akyn-ai'

/**
 * Example: Custom embeddings provider using a local model or different API
 */
class CustomEmbeddings implements EmbeddingsProvider {
  readonly dimensions = 384 // Dimension of your model's embeddings

  async embed(text: string): Promise<EmbeddingResult> {
    // Replace with your actual embedding logic
    // Example: call a local model, use HuggingFace, etc.
    
    // This is a dummy implementation
    const embedding = new Array(this.dimensions)
      .fill(0)
      .map(() => Math.random() - 0.5)
    
    return { embedding, tokenCount: text.split(' ').length }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    // For efficiency, batch your API calls here
    return Promise.all(texts.map(t => this.embed(t)))
  }
}

/**
 * Example: Using Cohere embeddings
 */
class CohereEmbeddings implements EmbeddingsProvider {
  readonly dimensions = 1024
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const response = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        texts: [text],
        model: 'embed-english-v3.0',
        input_type: 'search_document',
      }),
    })

    const data = await response.json()
    return {
      embedding: data.embeddings[0],
      tokenCount: data.meta?.billed_units?.input_tokens,
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const response = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        texts,
        model: 'embed-english-v3.0',
        input_type: 'search_document',
      }),
    })

    const data = await response.json()
    return data.embeddings.map((embedding: number[]) => ({
      embedding,
      tokenCount: Math.ceil((data.meta?.billed_units?.input_tokens || 0) / texts.length),
    }))
  }
}

async function main() {
  // Use custom embeddings
  const kb = new KnowledgeBase({
    name: 'custom-kb',
    description: 'Knowledge base with custom embeddings',
    embeddings: new CustomEmbeddings(),
    // Or use Cohere:
    // embeddings: new CohereEmbeddings(process.env.COHERE_API_KEY!),
  })

  await kb.addText('This is a test document with custom embeddings.')

  kb.serveStdio()
}

main().catch(console.error)

