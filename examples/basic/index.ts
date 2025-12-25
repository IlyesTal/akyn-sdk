/**
 * Basic Example
 * 
 * Index a directory and serve as MCP server for Cursor/Claude Desktop
 */

import { KnowledgeBase } from '@akyn/mcp-kb'

async function main() {
  // Create a knowledge base
  const kb = new KnowledgeBase({
    name: 'my-docs',
    description: 'My project documentation',
  })

  // Add content from a directory
  await kb.addDirectory('./docs', {
    recursive: true,
    extensions: ['.md', '.txt', '.pdf'],
  })

  // You can also add individual files
  // await kb.addFile('./README.md')
  
  // Or URLs
  // await kb.addURL('https://docs.example.com/guide')

  // Or raw text
  // await kb.addText('This is some important information', 'Important Notes')

  console.log(`Knowledge base "${kb.info.name}" ready with ${kb.listSources().length} sources`)

  // Start as stdio server (for Cursor/Claude Desktop)
  kb.serveStdio({ debug: true })
}

main().catch(console.error)

