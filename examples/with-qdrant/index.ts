/**
 * Example: Using Qdrant as the vector store
 * 
 * Qdrant is a high-performance vector database that's perfect for
 * production workloads. This example shows how easy it is to use.
 * 
 * Quick start:
 *   1. Start Qdrant: docker run -p 6333:6333 qdrant/qdrant
 *   2. Run this example: OPENAI_API_KEY=sk-... npx ts-node index.ts
 */

import { KnowledgeBase, QdrantVectorStore } from 'akyn-ai'

async function main() {
  // Create a knowledge base with Qdrant
  // That's it! No other config needed for local Docker
  const kb = new KnowledgeBase({
    name: 'my-docs',
    description: 'Documentation with Qdrant backend',
    vectorStore: new QdrantVectorStore(),
  })

  // Add some content
  await kb.addText(
    `
    Qdrant is a vector database that stores embeddings and enables fast
    similarity search. It supports filtering, payload storage, and scales
    to billions of vectors.
    
    Key features:
    - Written in Rust for performance
    - REST and gRPC APIs
    - Supports multiple distance metrics
    - Horizontal scaling with sharding
    - HNSW index for fast approximate search
    `,
    'Qdrant Overview'
  )

  await kb.addText(
    `
    To run Qdrant locally with Docker:
    
    docker run -p 6333:6333 qdrant/qdrant
    
    This starts Qdrant with the REST API on port 6333.
    Data is stored in memory by default.
    
    For persistent storage:
    docker run -p 6333:6333 -v ./qdrant_storage:/qdrant/storage qdrant/qdrant
    `,
    'Qdrant Docker Setup'
  )

  // Query it
  const results = await kb.query('How do I run Qdrant with Docker?')
  
  console.log('Query results:')
  for (const result of results) {
    console.log(`\n[Score: ${result.score.toFixed(3)}] ${result.source?.name}`)
    console.log(result.text.substring(0, 200) + '...')
  }

  // Serve as MCP server
  console.log('\nStarting MCP server...')
  kb.serveStdio()
}

main().catch(console.error)

