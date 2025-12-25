/**
 * Text chunking utilities
 * Splits text into optimal chunks for embedding
 */

export interface ChunkOptions {
  /**
   * Maximum size of each chunk in characters
   * @default 1000
   */
  maxSize?: number
  
  /**
   * Number of characters to overlap between chunks
   * Helps maintain context across chunk boundaries
   * @default 200
   */
  overlap?: number
  
  /**
   * Primary separator to split text on (e.g., paragraphs)
   * @default '\n\n'
   */
  separator?: string
}

export interface Chunk {
  /** The chunk text content */
  text: string
  /** Index of this chunk in the sequence */
  index: number
  /** Character offset in the original text */
  startOffset: number
  /** Character offset end in the original text */
  endOffset: number
}

/**
 * Split text into chunks for embedding
 * 
 * Strategy:
 * 1. Split by separator (paragraphs by default)
 * 2. Combine small paragraphs into chunks up to maxSize
 * 3. Split large paragraphs by sentences if needed
 * 4. Add overlap between chunks for context continuity
 */
export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const {
    maxSize = 500,
    overlap = 200,
    separator = '\n\n',
  } = options

  // Split by separator (paragraphs)
  const paragraphs = text.split(separator).filter(p => p.trim())
  
  const rawChunks: string[] = []
  let currentChunk = ''

  for (const paragraph of paragraphs) {
    // If paragraph itself is too large, split by sentences
    if (paragraph.length > maxSize) {
      // Save current chunk if any
      if (currentChunk.trim()) {
        rawChunks.push(currentChunk.trim())
        currentChunk = ''
      }
      
      // Split large paragraph by sentences
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph]
      
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxSize) {
          if (currentChunk.trim()) {
            rawChunks.push(currentChunk.trim())
          }
          currentChunk = sentence
        } else {
          currentChunk += (currentChunk ? ' ' : '') + sentence
        }
      }
    } else {
      // Check if adding this paragraph exceeds max size
      const potentialChunk = currentChunk 
        ? currentChunk + separator + paragraph 
        : paragraph

      if (potentialChunk.length > maxSize) {
        if (currentChunk.trim()) {
          rawChunks.push(currentChunk.trim())
        }
        currentChunk = paragraph
      } else {
        currentChunk = potentialChunk
      }
    }
  }

  // Add remaining chunk
  if (currentChunk.trim()) {
    rawChunks.push(currentChunk.trim())
  }

  // Add overlap between chunks for better context
  const chunks: Chunk[] = []
  let currentOffset = 0

  for (let i = 0; i < rawChunks.length; i++) {
    let chunkText = rawChunks[i]
    
    // Add overlap from previous chunk
    if (overlap > 0 && i > 0) {
      const prevChunk = rawChunks[i - 1]
      const overlapText = prevChunk.slice(-overlap)
      chunkText = overlapText + '... ' + chunkText
    }
    
    const startOffset = currentOffset
    const endOffset = startOffset + rawChunks[i].length
    
    chunks.push({
      text: chunkText,
      index: i,
      startOffset,
      endOffset,
    })
    
    currentOffset = endOffset + separator.length
  }

  return chunks
}

/**
 * Estimate token count for a text
 * Rough approximation: ~4 characters per token for English
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

