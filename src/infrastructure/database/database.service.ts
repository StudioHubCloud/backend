import { Inject, Injectable } from '@nestjs/common'
import { DATABASE_CONNECTION_DRIZZLE } from './database.connection'
import { Database } from './database.module'

@Injectable()
export class DatabaseService {
  constructor(@Inject(DATABASE_CONNECTION_DRIZZLE) public readonly drizzle: Database) {}
}
