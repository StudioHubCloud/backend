const TARGET_CHUNK_SIZE = 1200

// Deliberately crude — appropriate for a few dozen short, manually-authored FAQ/policy docs, not
// a general-purpose RAG chunker. Splits on "##" heading boundaries when present, otherwise on
// paragraph breaks, then greedily packs pieces up to ~TARGET_CHUNK_SIZE characters.
export function chunkMarkdown(text: string): string[] {
  const pieces = text.includes('\n## ') ? splitOnHeadings(text) : splitOnParagraphs(text)
  const chunks: string[] = []
  let current = ''

  for (const piece of pieces) {
    if (current && current.length + piece.length + 2 > TARGET_CHUNK_SIZE) {
      chunks.push(current.trim())
      current = ''
    }
    current = current ? `${current}\n\n${piece}` : piece
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks
}

function splitOnHeadings(text: string): string[] {
  return text
    .split(/\n(?=## )/)
    .map((section) => section.trim())
    .filter(Boolean)
}

function splitOnParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}
