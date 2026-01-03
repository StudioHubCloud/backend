import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common'
import { Pool } from 'pg'
import { DATABASE_CONNECTION_DRIZZLE, DATABASE_POOL } from './database.connection'
import { Database } from './database.module'

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  constructor(
    @Inject(DATABASE_CONNECTION_DRIZZLE) public readonly drizzle: Database,
    @Inject(DATABASE_POOL) public readonly pool: Pool,
  ) {}

  async onModuleDestroy() {
    try {
      await this.pool.end()
      console.log('[DATABASE] Connection pool closed gracefully')
    } catch (error) {
      console.error('[DATABASE] Error closing connection pool:', error)
    }
  }
}
