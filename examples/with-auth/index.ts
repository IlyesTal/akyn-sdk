/**
 * HTTP Server with Authentication Example
 * 
 * Run an MCP knowledge base as an HTTP server with authentication
 */

import { KnowledgeBase } from 'akyn-ai'

async function main() {
  // Create a knowledge base
  const kb = new KnowledgeBase({
    name: 'protected-docs',
    description: 'Protected API documentation',
  })

  // Add some content
  await kb.addText(`
    # Protected API Documentation
    
    This is confidential documentation that requires authentication.
    
    ## Internal Endpoints
    
    ### GET /internal/metrics
    Returns system metrics. Admin only.
    
    ### POST /internal/config
    Updates system configuration. Admin only.
  `, 'Internal Docs')

  // Start HTTP server with bearer token auth
  await kb.serveHttp({
    port: 3000,
    cors: true,
    debug: true,
    auth: {
      type: 'bearer',
      token: process.env.API_KEY || 'dev-secret-key',
    },
  })

  console.log('Protected server running at http://localhost:3000')
  console.log('')
  console.log('Test without auth (will fail):')
  console.log('  curl http://localhost:3000')
  console.log('')
  console.log('Test with auth:')
  console.log('  curl http://localhost:3000 -H "Authorization: Bearer dev-secret-key"')
  console.log('')
  console.log('Query with auth:')
  console.log('  curl -X POST http://localhost:3000 \\')
  console.log('    -H "Content-Type: application/json" \\')
  console.log('    -H "Authorization: Bearer dev-secret-key" \\')
  console.log('    -d \'{"jsonrpc":"2.0","method":"tools/call","params":{"name":"query","arguments":{"question":"What internal endpoints exist?"}},"id":1}\'')
}

main().catch(console.error)

