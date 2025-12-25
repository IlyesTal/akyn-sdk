/**
 * HTTP Server Example
 * 
 * Run an MCP knowledge base as an HTTP server
 */

import { KnowledgeBase } from 'akyn-ai'

async function main() {
  // Create a knowledge base
  const kb = new KnowledgeBase({
    name: 'api-docs',
    description: 'API documentation knowledge base',
  })

  // Add some content
  await kb.addText(`
    # API Documentation
    
    ## Authentication
    All API requests require a Bearer token in the Authorization header.
    
    ## Endpoints
    
    ### GET /users
    Returns a list of all users.
    
    ### POST /users
    Creates a new user. Requires name and email in the request body.
    
    ### GET /users/:id
    Returns a specific user by ID.
  `, 'API Docs')

  // Start HTTP server
  await kb.serveHttp({
    port: 3000,
    cors: true,
    debug: true,
  })

  console.log('Server running at http://localhost:3000')
  console.log('')
  console.log('Test with:')
  console.log('  curl http://localhost:3000')
  console.log('')
  console.log('Query with:')
  console.log('  curl -X POST http://localhost:3000 \\')
  console.log('    -H "Content-Type: application/json" \\')
  console.log('    -d \'{"jsonrpc":"2.0","method":"tools/call","params":{"name":"query","arguments":{"question":"How do I authenticate?"}},"id":1}\'')
}

main().catch(console.error)

