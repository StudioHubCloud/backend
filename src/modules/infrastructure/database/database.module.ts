import { Global, Module } from '@nestjs/common'
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'
import { TypedConfigService } from '@app/modules/infrastructure/config'
import { Pool } from 'pg'
import { DATABASE_CONNECTION } from './database.connection'
import * as schema from './schemas'

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [TypedConfigService],
      useFactory: async (configService: TypedConfigService) => {
        const DB_URL = configService.get('DATABASE_URL')
        const pool = new Pool({
          connectionString: DB_URL,
          ssl: true,
        })
        return drizzle(pool, { schema }) as DataBase
      },
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}

export type DataBase = NodePgDatabase<typeof schema>
