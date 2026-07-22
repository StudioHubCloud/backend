import { Pool } from 'pg'
import { AI_RISK_TIER, AiToolDefinition } from '../ai.types'

const MAX_ROWS = 200

// Dynamic schema summary is appended to this by the caller (AiAssistantService.handleMessage)
// at request time, not baked in here — see schema-summary.provider.ts.
export const RUN_READONLY_QUERY_STATIC_DESCRIPTION =
  "Run a read-only SQL query directly against the studio database to answer questions the other tools don't cover. " +
  'Only a single SELECT or WITH statement is allowed per call — no semicolon-separated chains. ' +
  `Results are capped at ${MAX_ROWS} rows; if you hit the cap, narrow your WHERE/LIMIT instead of assuming the result is complete. ` +
  'The schema (tables and columns available today) is listed below.'

function assertReadonlyStatement(query: string): string {
  const trimmed = query.trim()
  const withoutTrailingSemicolon = trimmed.endsWith(';') ? trimmed.slice(0, -1) : trimmed

  if (withoutTrailingSemicolon.includes(';')) {
    throw new Error('Only a single SQL statement is allowed per call.')
  }

  if (!/^(select|with)\b/i.test(withoutTrailingSemicolon)) {
    throw new Error('Only SELECT and WITH statements are allowed.')
  }

  return withoutTrailingSemicolon
}

export function buildRunReadonlyQueryTool(deps: { readonlyPool: Pool }): AiToolDefinition {
  const { readonlyPool } = deps

  return {
    name: 'run_readonly_query',
    description: RUN_READONLY_QUERY_STATIC_DESCRIPTION,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'A single SELECT or WITH statement.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    riskTier: AI_RISK_TIER.STANDARD,
    execute: async (_actor, input: { query: string }) => {
      const statement = assertReadonlyStatement(input.query)
      const { rows } = await readonlyPool.query(statement)
      const truncated = rows.length > MAX_ROWS

      return {
        result: {
          rows: truncated ? rows.slice(0, MAX_ROWS) : rows,
          rowCount: rows.length,
          truncated,
        },
      }
    },
  }
}
