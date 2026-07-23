import { Pool } from 'pg'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, CallToolResult, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js'
import { buildRunReadonlyQueryTool } from '@app/infrastructure/ai/tools/run-readonly-query.tool'

// Deliberately minimal, single-tool MCP server — a first step to learn the protocol mechanics,
// not the full multi-tool/JWT/confirmation-flow design. No NestJS bootstrap at all: the only tool
// exposed (run_readonly_query) needs nothing but a read-only Postgres pool, so there's no reason
// to spin up the app's DI container (which would also pull in PinoLogger, RedisCacheService, and
// every other tool's transitive dependencies for no benefit). stdio-only: it's a trusted local
// subprocess (launched directly by Claude Desktop/Code), so there's no separate auth/token check
// to add here — that only matters once/if a network transport is added later.
//
// Imports the tool directly from its own file, not the tools/index.ts barrel — the barrel pulls in
// all 15 tools, some of which transitively import bot helpers with real dependencies (Telegram bot
// token, other domain services). This tool file only needs a Pool.

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: false }
}

function errorResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile()
  } catch {
    // .env may not exist if env vars are already injected another way — fall back silently.
  }

  const connectionString = process.env.DATABASE_URL_READONLY
  if (!connectionString) {
    process.stderr.write('DATABASE_URL_READONLY environment variable is required.\n')
    process.exit(1)
  }

  const readonlyPool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })

  // Graceful shutdown: without this, killing the process (e.g. Claude Desktop tearing down the
  // subprocess) just yanks the OS socket out from under Postgres — harmless, but noisy in its
  // logs and doesn't let an in-flight query finish. pool.end() waits for in-flight queries, then
  // closes every connection in the pool cleanly.
  const shutdown = async () => {
    await readonlyPool.end()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  const tool = buildRunReadonlyQueryTool({ readonlyPool })

  const server = new Server({ name: 'studio-hub-mcp', version: '0.1.0' }, { capabilities: { tools: {} } })

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [{ name: tool.name, description: tool.description, inputSchema: tool.inputSchema as Tool['inputSchema'] }]
    return { tools }
  })

  const handleCallTool = async (request: { params: { name: string; arguments?: Record<string, unknown> } }): Promise<CallToolResult> => {
    if (request.params.name !== tool.name) {
      return errorResult(`Unknown tool: ${request.params.name}`)
    }

    try {
      // No actor concept in this minimal server — run_readonly_query doesn't use it.
      const { result } = await tool.execute(undefined as never, request.params.arguments ?? {})
      return textResult(JSON.stringify(result))
    } catch (error) {
      return errorResult(getErrorMessage(error))
    }
  }
  // Cast needed: matching the SDK's zod-inferred SchemaOutput<typeof CallToolRequestSchema> exactly
  // (a deeply nested conditional type across its zod v3/v4 compat layer) makes TS give up with
  // "Type instantiation is excessively deep" — request.params.name/arguments is exactly what the
  // SDK hands the handler at runtime regardless.
  server.setRequestHandler(CallToolRequestSchema, handleCallTool as never)

  await server.connect(new StdioServerTransport())

  // Never console.log/write to stdout here — it's the JSON-RPC channel. stderr is safe.
  process.stderr.write('MCP stdio server started (run_readonly_query only).\n')
}

main().catch((error) => {
  process.stderr.write(`MCP stdio server failed to start: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`)
  process.exit(1)
})
