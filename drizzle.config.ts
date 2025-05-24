import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: "./drizzle",
  schema: './src/infrastructure/database/schemas',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
})
