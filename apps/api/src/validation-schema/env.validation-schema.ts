import { z } from 'zod'

export const envValidationSchema = z.object({
  PORT: z.coerce.number().optional().default(3000),
  DB_PORT: z.coerce.number(),
  DB_USER: z.string(),
  DB_PASS: z.string(),
  DB_NAME: z.string(),
  DB_HOST: z.string(),
})

export type TApiEnv = z.infer<typeof envValidationSchema>
