/**
 * File parsing utilities
 * Supports PDF, DOCX, TXT, and Markdown files
 */

import { normalizeText, stripMarkdown } from '../processing/normalizer'

export type FileType = 'pdf' | 'docx' | 'txt' | 'md'

/**
 * Detect file type from filename or path
 */
export function detectFileType(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase()
  
  switch (ext) {
    case 'pdf':
      return 'pdf'
    case 'docx':
    case 'doc':
      return 'docx'
    case 'md':
    case 'markdown':
      return 'md'
    case 'txt':
    default:
      return 'txt'
  }
}

/**
 * Parse PDF content to text
 */
export async function parsePDF(buffer: ArrayBuffer): Promise<string> {
  // pdf-parse has a quirky import, handle it carefully
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse/lib/pdf-parse.js')
  
  const data = await pdfParse(Buffer.from(buffer))
  return normalizeText(data.text)
}

/**
 * Parse DOCX content to text
 */
export async function parseDOCX(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth')
  
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(buffer),
  })
  
  return normalizeText(result.value)
}

/**
 * Parse plain text content
 */
export function parseTXT(text: string): string {
  return normalizeText(text)
}

/**
 * Parse Markdown content to plain text
 */
export function parseMarkdown(markdown: string): string {
  return stripMarkdown(markdown)
}

/**
 * Parse a file buffer based on its type
 */
export async function parseFile(
  buffer: ArrayBuffer,
  type: FileType
): Promise<string> {
  switch (type) {
    case 'pdf':
      return parsePDF(buffer)
    case 'docx':
      return parseDOCX(buffer)
    case 'md':
      const mdText = new TextDecoder().decode(buffer)
      return parseMarkdown(mdText)
    case 'txt':
    default:
      const txtText = new TextDecoder().decode(buffer)
      return parseTXT(txtText)
  }
}

/**
 * Read and parse a file from the filesystem
 */
export async function loadFile(path: string): Promise<string> {
  const fs = await import('fs/promises')
  const buffer = await fs.readFile(path)
  const type = detectFileType(path)
  return parseFile(buffer.buffer as ArrayBuffer, type)
}

/**
 * Load all files from a directory
 */
export async function loadDirectory(
  dirPath: string,
  options: {
    recursive?: boolean
    extensions?: string[]
  } = {}
): Promise<Array<{ path: string; content: string }>> {
  const fs = await import('fs/promises')
  const path = await import('path')
  
  const {
    recursive = true,
    extensions = ['.txt', '.md', '.pdf', '.docx'],
  } = options

  const results: Array<{ path: string; content: string }> = []
  
  async function processDir(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)
      
      if (entry.isDirectory() && recursive) {
        await processDir(fullPath)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (extensions.includes(ext)) {
          try {
            const content = await loadFile(fullPath)
            results.push({ path: fullPath, content })
          } catch (error) {
            console.warn(`Failed to load ${fullPath}:`, error)
          }
        }
      }
    }
  }
  
  await processDir(dirPath)
  return results
}

