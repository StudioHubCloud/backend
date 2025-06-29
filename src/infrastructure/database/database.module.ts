import { Global, Module } from '@nestjs/common'
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'
import { TypedConfigService } from '@app/infrastructure/config'
import { Pool } from 'pg'
import { DATABASE_CONNECTION_DRIZZLE } from './database.connection'
import * as schema from './schemas'
import { DatabaseService } from './database.service'

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION_DRIZZLE,
      inject: [TypedConfigService],
      useFactory: async (configService: TypedConfigService) => {
        const DB_URL = configService.get('DATABASE_URL')
        const pool = new Pool({
          connectionString: DB_URL,
          ssl: true,
        })
        return drizzle(pool, { schema, logger: true }) as Database
      },
    },
    DatabaseService,
  ],
  exports: [DATABASE_CONNECTION_DRIZZLE, DatabaseService],
})
export class DatabaseModule {}

export type Database = NodePgDatabase<typeof schema>
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
