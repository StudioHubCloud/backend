import { z } from 'zod'

export const envValidationSchema = z.object({
  PORT: z.coerce.number(),
  REDIS_PORT: z.coerce.number(),
  REDIS_HOST: z.string(),
  DATABASE_URL: z.string(),
  BOT_TOKEN: z.string(),
})

export type EnvVariables = z.infer<typeof envValidationSchema>
