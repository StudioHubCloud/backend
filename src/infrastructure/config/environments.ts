import z from 'zod'

export const environmentsSchema = z.object({
  PORT: z.coerce.number().default(3000),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  DATABASE_URL: z.string(),
  BOT_TOKEN: z.string(),
  BOT_TOKEN_TEST: z.string().default(''),
  MAINTAINER_CHAT_ID: z.string(),
  TIME_ZONE: z.string().default('Europe/Kyiv'),
  RAILWAY_PUBLIC_DOMAIN: z.string().default('localhost'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'trace']).default('debug'),
  LOG_LEVEL_HTTP: z.enum(['debug', 'info', 'warn', 'error', 'trace']).default('debug'),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  STUDIO_ID: z.string(),
  STUDIO_ID_TEST: z.string().default(''),
  GOOGLE_PLACE_ID: z.string(),
})

export type Env = z.infer<typeof environmentsSchema>

export default (): Env => environmentsSchema.parse(process.env)
