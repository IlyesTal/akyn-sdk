/**
 * Example: Using Qdrant Cloud
 * 
 * Qdrant Cloud is a fully managed vector database service.
 * Get started free at: https://cloud.qdrant.io
 * 
 * Run: OPENAI_API_KEY=sk-... QDRANT_URL=https://xxx.cloud.qdrant.io QDRANT_API_KEY=... npx ts-node qdrant-cloud.ts
 */

import { KnowledgeBase, QdrantVectorStore } from 'akyn-ai'

async function main() {
  // Get Qdrant Cloud credentials from environment
  const qdrantUrl = process.env.QDRANT_URL
  const qdrantApiKey = process.env.QDRANT_API_KEY

  if (!qdrantUrl || !qdrantApiKey) {
    console.error('Please set QDRANT_URL and QDRANT_API_KEY environment variables')
    console.error('Get your credentials at: https://cloud.qdrant.io')
    process.exit(1)
  }

  // Create a knowledge base with Qdrant Cloud
  const kb = new KnowledgeBase({
    name: 'cloud-docs',
    description: 'Documentation stored in Qdrant Cloud',
    vectorStore: new QdrantVectorStore({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
      collection: 'my-docs', // Optional: defaults to 'akyn_documents'
    }),
  })

  // Add content
  await kb.addText(
    'This content is stored in Qdrant Cloud and persists across restarts.',
    'Cloud Storage'
  )

  // Query
  const results = await kb.query('Where is the data stored?')
  console.log('Results:', results)

  // Start server
  kb.serveStdio()
}

main().catch(console.error)

