import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common'
import { Pool } from 'pg'
import { DATABASE_CONNECTION_DRIZZLE, DATABASE_POOL, DATABASE_POOL_READONLY } from './database.connection'
import { Database } from './database.module'

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  constructor(
    @Inject(DATABASE_CONNECTION_DRIZZLE) public readonly drizzle: Database,
    @Inject(DATABASE_POOL) public readonly pool: Pool,
    @Inject(DATABASE_POOL_READONLY) public readonly readonlyPool: Pool,
  ) {}

  async onModuleDestroy() {
    try {
      await Promise.all([this.pool.end(), this.readonlyPool.end()])
      console.log('[DATABASE] Connection pools closed gracefully')
    } catch (error) {
      console.error('[DATABASE] Error closing connection pools:', error)
    }
  }
}
