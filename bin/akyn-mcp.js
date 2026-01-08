#!/usr/bin/env node

/**
 * CLI for running an MCP knowledge base server
 * 
 * Usage:
 *   akyn-mcp --config ./kb-config.json
 *   akyn-mcp --dir ./docs --name "My Docs"
 */

const { KnowledgeBase } = require('../dist/index.js')
const fs = require('fs')
const path = require('path')

async function main() {
  const args = process.argv.slice(2)
  
  // Parse arguments
  let configPath = null
  let dirPath = null
  let name = 'Knowledge Base'
  let httpPort = null
  let debug = false
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--config':
      case '-c':
        configPath = args[++i]
        break
      case '--dir':
      case '-d':
        dirPath = args[++i]
        break
      case '--name':
      case '-n':
        name = args[++i]
        break
      case '--http':
        httpPort = parseInt(args[++i], 10)
        break
      case '--debug':
        debug = true
        break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
    }
  }
  
  // Load config if provided
  let config = { name, description: '', sources: [] }
  
  if (configPath) {
    try {
      const configContent = fs.readFileSync(path.resolve(configPath), 'utf-8')
      config = { ...config, ...JSON.parse(configContent) }
    } catch (error) {
      console.error(`Failed to load config: ${error.message}`)
      process.exit(1)
    }
  }
  
  // Create knowledge base
  const kb = new KnowledgeBase({
    name: config.name,
    description: config.description,
  })
  
  // Add sources from config
  if (config.sources && Array.isArray(config.sources)) {
    for (const source of config.sources) {
      try {
        if (source.type === 'directory') {
          console.error(`Loading directory: ${source.path}`)
          await kb.addDirectory(source.path, source.options)
        } else if (source.type === 'file') {
          console.error(`Loading file: ${source.path}`)
          await kb.addFile(source.path)
        } else if (source.type === 'url') {
          console.error(`Loading URL: ${source.url}`)
          await kb.addURL(source.url)
        }
      } catch (error) {
        console.error(`Failed to load source: ${error.message}`)
      }
    }
  }
  
  // Add directory if specified via CLI
  if (dirPath) {
    console.error(`Loading directory: ${dirPath}`)
    await kb.addDirectory(path.resolve(dirPath))
  }
  
  // Start server
  if (httpPort) {
    await kb.serveHttp({ port: httpPort, debug })
  } else {
    kb.serveStdio({ debug })
  }
}

function printHelp() {
  console.log(`
akyn-mcp - Turn any data source into an MCP server

Usage:
  akyn-mcp [options]

Options:
  -c, --config <path>   Path to config JSON file
  -d, --dir <path>      Directory to index
  -n, --name <name>     Name for the knowledge base
  --http <port>         Run as HTTP server on specified port
  --debug               Enable debug logging
  -h, --help            Show this help message

Examples:
  # Index a directory and run as stdio server
  akyn-mcp --dir ./docs --name "My Docs"
  
  # Use a config file
  akyn-mcp --config ./kb-config.json
  
  # Run as HTTP server
  akyn-mcp --dir ./docs --http 3000

Config file format:
  {
    "name": "My Knowledge Base",
    "description": "Description here",
    "sources": [
      { "type": "directory", "path": "./docs" },
      { "type": "file", "path": "./guide.pdf" },
      { "type": "url", "url": "https://example.com" }
    ]
  }

For more info, visit: https://github.com/IlyesTal/akyn-sdk
`)
}

main().catch(error => {
  console.error(`Fatal error: ${error.message}`)
  process.exit(1)
})

