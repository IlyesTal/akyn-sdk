# akyn-ai

**Turn any data source into an MCP server in 5 minutes.**

Build knowledge bases that AI assistants like Claude and Cursor can query directly. No infrastructure needed.

[![npm version](https://img.shields.io/npm/v/akyn-ai)](https://www.npmjs.com/package/akyn-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is this?

This SDK lets you create [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) servers from any data source. Your docs, PDFs, websites, or any text can become a queryable knowledge base that AI assistants can access directly.

**Use cases:**
- 📚 Make your documentation searchable by Cursor/Claude
- 🔍 Build RAG (Retrieval-Augmented Generation) pipelines
- 🤖 Create custom AI assistants with domain knowledge
- 📖 Index research papers, guides, or any text content

---

## Quick Start

### Install

```bash
npm install akyn-ai
```

### Basic Usage

```typescript
import { KnowledgeBase } from 'akyn-ai'

// Create a knowledge base
const kb = new KnowledgeBase({
  name: 'my-docs',
  description: 'My project documentation',
})

// Add your content
await kb.addDirectory('./docs')           // Add all docs from a folder
await kb.addFile('./README.md')           // Add a specific file
await kb.addURL('https://docs.example.com') // Scrape a URL
await kb.addText('Important info here')   // Add raw text

// Serve as MCP server
kb.serveStdio()  // For Cursor/Claude Desktop
```

### Connect to Cursor

Add to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "my-docs": {
      "command": "npx",
      "args": ["ts-node", "./my-kb.ts"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-docs": {
      "command": "npx",
      "args": ["ts-node", "/path/to/my-kb.ts"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

---

## Features

### 📁 Multi-Source Ingestion

```typescript
// Files (PDF, DOCX, TXT, Markdown)
await kb.addFile('./guide.pdf')
await kb.addFile('./manual.docx')

// Directories (recursive)
await kb.addDirectory('./docs', {
  recursive: true,
  extensions: ['.md', '.txt', '.pdf'],
})

// URLs
await kb.addURL('https://docs.example.com')
await kb.addURLs([
  'https://example.com/page1',
  'https://example.com/page2',
])

// Raw text
await kb.addText('Custom content here', 'My Notes')
```

### 🔍 Smart Chunking

Text is automatically split into optimal chunks for embedding:

```typescript
const kb = new KnowledgeBase({
  name: 'my-kb',
  chunking: {
    maxSize: 1000,    // Max characters per chunk
    overlap: 200,     // Overlap between chunks for context
  },
})
```

### 🧠 Flexible Embeddings

Uses OpenAI by default, but you can bring your own:

```typescript
import { KnowledgeBase, type EmbeddingsProvider } from 'akyn-ai'

// Use OpenAI (default)
const kb = new KnowledgeBase({ name: 'my-kb' })

// Or customize OpenAI settings
import { OpenAIEmbeddings } from 'akyn-ai'

const kb = new KnowledgeBase({
  name: 'my-kb',
  embeddings: new OpenAIEmbeddings({
    model: 'text-embedding-3-large',  // Better quality
    apiKey: 'sk-...',
  }),
})

// Or bring your own provider
class MyEmbeddings implements EmbeddingsProvider {
  readonly dimensions = 384
  
  async embed(text: string) {
    // Your embedding logic here
    return { embedding: [...], tokenCount: 100 }
  }
  
  async embedBatch(texts: string[]) {
    return Promise.all(texts.map(t => this.embed(t)))
  }
}

const kb = new KnowledgeBase({
  name: 'my-kb',
  embeddings: new MyEmbeddings(),
})
```

### 💾 Pluggable Vector Stores

In-memory by default, but you can use your own:

```typescript
import { InMemoryVectorStore } from 'akyn-ai'

// In-memory with persistence
const kb = new KnowledgeBase({
  name: 'my-kb',
  vectorStore: new InMemoryVectorStore({
    persistPath: './kb-data.json',  // Save to disk
  }),
})

// Or implement your own (Qdrant, Pinecone, etc.)
class QdrantVectorStore implements VectorStore {
  // ... implement the interface
}
```

### 🌐 Multiple Transport Options

```typescript
// Stdio (for Cursor/Claude Desktop)
kb.serveStdio()

// HTTP (for web clients)
await kb.serveHttp({ port: 3000 })
```

---

## CLI Usage

You can also use the CLI without writing code:

```bash
# Index a directory
npx akyn-ai --dir ./docs --name "My Docs"

# Use a config file
npx akyn-ai --config ./kb-config.json

# Run as HTTP server
npx akyn-ai --dir ./docs --http 3000
```

### Config File Format

```json
{
  "name": "My Knowledge Base",
  "description": "Project documentation",
  "sources": [
    { "type": "directory", "path": "./docs" },
    { "type": "file", "path": "./README.md" },
    { "type": "url", "url": "https://docs.example.com" }
  ]
}
```

---

## API Reference

### `KnowledgeBase`

Main class for creating and managing knowledge bases.

```typescript
const kb = new KnowledgeBase({
  name: string,           // Required: Name of the knowledge base
  description?: string,   // Optional: Description
  version?: string,       // Optional: Version (default: '1.0.0')
  embeddings?: EmbeddingsProvider,  // Optional: Custom embeddings
  vectorStore?: VectorStore,        // Optional: Custom vector store
  chunking?: ChunkOptions,          // Optional: Chunking settings
  retrieval?: RetrievalOptions,     // Optional: Retrieval settings
})
```

### Retrieval Options

Configure how results are retrieved from the knowledge base:

```typescript
const kb = new KnowledgeBase({
  name: 'my-kb',
  retrieval: {
    topK: 5,        // Number of chunks to retrieve (default: 5)
    threshold: 0,   // Minimum similarity score 0-1 (default: 0)
  },
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `topK` | number | 5 | Maximum number of chunks to retrieve |
| `threshold` | number | 0 | Minimum similarity score (0-1). Results below this are filtered out |

> **Note:** These options are configured in code, not exposed to AI agents via MCP. This gives you full control over retrieval behavior.

#### Methods

| Method | Description |
|--------|-------------|
| `addText(text, name?)` | Add raw text content |
| `addFile(path, name?)` | Add a file (PDF, DOCX, TXT, MD) |
| `addDirectory(path, options?)` | Add all files from a directory |
| `addURL(url, name?)` | Add content from a URL |
| `addURLs(urls)` | Add multiple URLs |
| `query(question, options?)` | Query the knowledge base |
| `listSources()` | List all indexed sources |
| `serveStdio(options?)` | Start stdio MCP server |
| `serveHttp(options?)` | Start HTTP MCP server |

### Utilities

The SDK also exports utilities you can use independently:

```typescript
import {
  // Text processing
  normalizeText,
  chunkText,
  extractTextFromHTML,
  stripMarkdown,
  
  // File loading
  loadFile,
  loadDirectory,
  loadURL,
  
  // Embeddings
  OpenAIEmbeddings,
  cosineSimilarity,
  
  // Vector store
  InMemoryVectorStore,
} from 'akyn-ai'
```

---

## MCP Tools

When connected via MCP, your knowledge base exposes these tools:

### `query`

Search the knowledge base with a natural language question.

```json
{
  "name": "query",
  "arguments": {
    "question": "How do I authenticate?"
  }
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `question` | string | The question to search for |

> **Note:** The number of results and similarity threshold are configured via the `retrieval` option when creating the KnowledgeBase. See [Retrieval Options](#retrieval-options).

### `list_sources`

List all indexed sources in the knowledge base.

```json
{
  "name": "list_sources",
  "arguments": {}
}
```

---

## Examples

See the [examples](./examples) directory for more:

- [Basic usage](./examples/basic)
- [HTTP server](./examples/http-server)
- [Custom embeddings](./examples/with-custom-embeddings)

---

## Requirements

- Node.js 18+
- OpenAI API key (or custom embeddings provider)

---

## Want Managed Hosting?

Building something bigger? Check out [Akyn](https://akyn.ai) for:

- ☁️ Hosted knowledge bases
- 👥 Team collaboration
- 📊 Usage analytics
- 💰 Monetization (charge for queries)
- 🔐 API key management

---

## Contributing

Contributions welcome! Please read our contributing guidelines first.

---

## License

MIT © [Akyn AI](https://akyn.ai)

