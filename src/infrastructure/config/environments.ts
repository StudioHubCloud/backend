import { ENVIRONMENTS } from '@app/libs/constants'
import z from 'zod'

export const environmentsSchema = z.object({
  PORT: z.coerce.number().default(3000),
  REDIS_URL: z.string(),
  DATABASE_URL: z.string(),
  DATABASE_URL_READONLY: z.string(),
  BOT_TOKEN: z.string(),
  BOT_TOKEN_TEST: z.string().default(''),
  MAINTAINER_CHAT_ID: z.string(),
  TIME_ZONE: z.string().default('Europe/Kyiv'),
  RAILWAY_PUBLIC_DOMAIN: z.string().default('localhost'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'trace']).default('debug'),
  LOG_LEVEL_HTTP: z.enum(['debug', 'info', 'warn', 'error', 'trace']).default('debug'),
  NODE_ENV: z.enum([ENVIRONMENTS.DEV, ENVIRONMENTS.PRODUCTION]).default(ENVIRONMENTS.DEV),
  STUDIO_ID: z.string(),
  STUDIO_ID_TEST: z.string().default(''),
  GOOGLE_PLACE_ID: z.string(),
  AI_API_KEY: z.string(),
  AI_MODEL_STANDARD: z.string(),
  AI_DAILY_CALL_LIMIT: z.coerce.number(),
  TRANSCRIPTION_SHARED_SECRET: z.string(),
  TRANSCRIPTION_SERVICE_URL: z.string(),
  INTERNAL_API_KEY: z.string(),
  AI_SYSTEM_NOTE_PREFIX: z.string(),
})

export type Env = z.infer<typeof environmentsSchema>

export default (): Env => environmentsSchema.parse(process.env)
