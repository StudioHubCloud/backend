import { TypedConfigService } from '@app/infrastructure/config'
import { ENVIRONMENTS } from '@app/libs'
import { Global, Module } from '@nestjs/common'
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { DATABASE_CONNECTION_DRIZZLE, DATABASE_POOL } from './database.connection'
import { DatabaseService } from './database.service'
import * as schema from './schemas'

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [TypedConfigService],
      useFactory: async (configService: TypedConfigService) => {
        const DB_URL = configService.get('DATABASE_URL')
        const sslConfig = process.env.NODE_ENV === ENVIRONMENTS.PRODUCTION ? { rejectUnauthorized: false } : false

        return new Pool({
          connectionString: DB_URL,
          ssl: sslConfig,
        })
      },
    },
    {
      provide: DATABASE_CONNECTION_DRIZZLE,
      inject: [DATABASE_POOL],
      useFactory: async (pool: Pool) => {
        return drizzle(pool, { schema }) as Database
      },
    },
    DatabaseService,
  ],
  exports: [DATABASE_CONNECTION_DRIZZLE, DATABASE_POOL, DatabaseService],
})
export class DatabaseModule {}

export type Database = NodePgDatabase<typeof schema>
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
