import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Pool } from 'pg'
import { DATABASE_CONNECTION } from './database.connection'
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from './schemas'

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const DB_URL = configService.get<string>('DATABASE_URL')
        const pool = new Pool({
          connectionString: DB_URL,
          ssl: true,
        })
        return drizzle(pool, { schema }) as NodePgDatabase<typeof schema>
      },
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
