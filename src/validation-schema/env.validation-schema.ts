import { z } from 'zod'

export const envValidationSchema = z.object({
  PORT: z.coerce.number().optional().default(3000),
  DATABASE_URL: z.string(),
})

export type TApiEnv = z.infer<typeof envValidationSchema>
