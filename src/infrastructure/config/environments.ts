import z from 'zod'

export const environmentsSchema = z.object({
  PORT: z.coerce.number().default(3000),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_HOST: z.string().default('localhost'),
  DATABASE_URL: z.string(),
  BOT_TOKEN: z.string(),
  BOT_TOKEN_TEST: z.string(),
  MAINTAINER_CHAT_ID: z.string(),
  RAILWAY_PUBLIC_DOMAIN: z.string().default('localhost'),
})

export type Env = z.infer<typeof environmentsSchema>

export default (): Env => environmentsSchema.parse(process.env)
