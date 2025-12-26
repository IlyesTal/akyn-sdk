/**
 * HTTP Server with OAuth Example
 * 
 * Run an MCP knowledge base protected by OAuth token introspection
 */

import { KnowledgeBase } from 'akyn-ai'

async function main() {
  const kb = new KnowledgeBase({
    name: 'oauth-protected-docs',
    description: 'OAuth protected documentation',
  })

  await kb.addText(`
    # OAuth Protected Documentation
    
    This documentation requires a valid OAuth access token.
  `, 'OAuth Docs')

  // Start HTTP server with OAuth introspection
  await kb.serveHttp({
    port: 3000,
    auth: {
      type: 'oauth',
      introspectionUrl: process.env.OAUTH_INTROSPECTION_URL || 'https://auth.example.com/oauth2/introspect',
      clientId: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
    },
  })

  console.log('OAuth-protected server running at http://localhost:3000')
  console.log('')
  console.log('Set environment variables:')
  console.log('  OAUTH_INTROSPECTION_URL - Your OAuth server introspection endpoint')
  console.log('  OAUTH_CLIENT_ID         - Client ID for introspection')
  console.log('  OAUTH_CLIENT_SECRET     - Client secret for introspection')
}

main().catch(console.error)

