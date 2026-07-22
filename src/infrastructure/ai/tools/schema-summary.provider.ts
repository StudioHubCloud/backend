import { Pool } from 'pg'
import { RedisCacheService } from '@app/infrastructure/redis'

const SCHEMA_SUMMARY_CACHE_KEY = 'ai:schema-summary'
const SCHEMA_SUMMARY_TTL_SECONDS = 60 * 60 * 24

interface SchemaColumnRow {
  table_name: string
  column_name: string
  data_type: string
}

// Cached for a day so handleMessage can afford to fetch it on every request (cache hit = one
// Redis GET) instead of the model needing a separate describe_schema tool call. Automatically
// stays reasonably fresh via the TTL; after a migration, delete the Redis key manually for an
// immediate refresh instead of waiting up to 24h.
export async function getSchemaSummary(redisCacheService: RedisCacheService, readonlyPool: Pool): Promise<string> {
  const cached = await redisCacheService.get<string>(SCHEMA_SUMMARY_CACHE_KEY)
  if (cached) {
    return cached
  }

  const { rows } = await readonlyPool.query<SchemaColumnRow>(
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position`,
  )

  const columnsByTable = new Map<string, string[]>()
  for (const row of rows) {
    const columns = columnsByTable.get(row.table_name) ?? []
    columns.push(`${row.column_name} ${row.data_type}`)
    columnsByTable.set(row.table_name, columns)
  }

  const summary = Array.from(columnsByTable.entries())
    .map(([tableName, columns]) => `${tableName}(${columns.join(', ')})`)
    .join('\n')

  await redisCacheService.set(SCHEMA_SUMMARY_CACHE_KEY, summary, SCHEMA_SUMMARY_TTL_SECONDS)
  return summary
}
