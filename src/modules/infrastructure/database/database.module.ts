import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { EnvVariables } from '@app/libs'
import { DATABASE_CONNECTION } from './database.connection'
import * as schema from './schemas'
import { ConfigModule } from '../config'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService<EnvVariables>) => {
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
