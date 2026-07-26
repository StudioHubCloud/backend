import { createHash } from 'crypto'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { basename, join } from 'path'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { and, eq } from 'drizzle-orm'
import { knowledgeBaseChunk, knowledgeBaseDocument } from '@app/infrastructure/database/schemas'
import { TypedConfigService } from '@app/infrastructure/config'
import { EmbeddingsService } from '@app/infrastructure/ai/rag/embeddings.service'
import { chunkMarkdown } from '@app/infrastructure/ai/rag/chunking.util'

// Standalone script, no NestJS bootstrap — same shape as mcp-stdio.ts. Run via `npm run kb:ingest`.
// Reads Markdown files from ./knowledge-base at the repo root, embeds them with Voyage AI, and
// upserts them into knowledge_base_document/knowledge_base_chunk, skipping docs whose content hasn't changed.

const KNOWLEDGE_BASE_DIR = join(process.cwd(), 'knowledge-base')

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    process.stderr.write(`${name} environment variable is required.\n`)
    process.exit(1)
  }
  return value
}

function getStudioId(): string {
  const isProduction = process.env.NODE_ENV === 'production'
  return requireEnv(isProduction ? 'STUDIO_ID' : 'STUDIO_ID_TEST')
}

function deriveSlugAndTitle(filePath: string, sourceText: string): { slug: string; title: string } {
  const slug = basename(filePath).replace(/\.md$/, '')
  const headingMatch = sourceText.match(/^#\s+(.+)$/m)
  const title = headingMatch ? headingMatch[1].trim() : slug
  return { slug, title }
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile()
  } catch {
    // .env may not exist if env vars are already injected another way — fall back silently.
  }

  if (!existsSync(KNOWLEDGE_BASE_DIR)) {
    process.stderr.write(`No knowledge-base/ directory found at ${KNOWLEDGE_BASE_DIR} — nothing to ingest.\n`)
    process.exit(1)
  }

  const studioId = getStudioId()
  const connectionString = requireEnv('DATABASE_URL')
  requireEnv('EMBEDDINGS_API_KEY')
  requireEnv('EMBEDDINGS_MODEL')

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
  const db = drizzle(pool)
  const configService = { get: (key: string) => process.env[key] } as TypedConfigService
  const embeddingsService = new EmbeddingsService(configService)

  const files = readdirSync(KNOWLEDGE_BASE_DIR).filter((file) => file.endsWith('.md'))

  let processed = 0
  let skipped = 0
  let chunksWritten = 0

  for (const file of files) {
    const filePath = join(KNOWLEDGE_BASE_DIR, file)
    const sourceText = readFileSync(filePath, 'utf-8')
    const { slug, title } = deriveSlugAndTitle(filePath, sourceText)
    const contentHash = createHash('sha256').update(sourceText).digest('hex')

    const [existing] = await db
      .select({ id: knowledgeBaseDocument.id, contentHash: knowledgeBaseDocument.contentHash })
      .from(knowledgeBaseDocument)
      .where(and(eq(knowledgeBaseDocument.studioId, studioId), eq(knowledgeBaseDocument.slug, slug)))
      .limit(1)

    if (existing && existing.contentHash === contentHash) {
      skipped++
      continue
    }

    const chunks = chunkMarkdown(sourceText)
    const embeddings = await embeddingsService.embedDocuments(chunks)

    const [document] = await db
      .insert(knowledgeBaseDocument)
      .values({ studioId, slug, title, sourceText, contentHash })
      .onConflictDoUpdate({
        target: [knowledgeBaseDocument.studioId, knowledgeBaseDocument.slug],
        set: { title, sourceText, contentHash, updatedAt: new Date().toISOString() },
      })
      .returning({ id: knowledgeBaseDocument.id })

    await db.delete(knowledgeBaseChunk).where(eq(knowledgeBaseChunk.documentId, document.id))

    await db.insert(knowledgeBaseChunk).values(
      chunks.map((content, index) => ({
        documentId: document.id,
        studioId,
        chunkIndex: index,
        content,
        embedding: embeddings[index],
      })),
    )

    chunksWritten += chunks.length
    processed++
    process.stdout.write(`Ingested "${title}" (${slug}): ${chunks.length} chunk(s).\n`)
  }

  process.stdout.write(`Done. Processed ${processed}, skipped ${skipped} (unchanged), ${chunksWritten} chunks written.\n`)
  await pool.end()
}

main().catch((error) => {
  process.stderr.write(`kb:ingest failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`)
  process.exit(1)
})
