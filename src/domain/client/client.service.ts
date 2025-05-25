import { Injectable } from '@nestjs/common'
import { client, ClientInsertModel, DatabaseService, Transaction } from '@app/infrastructure/database'

@Injectable()
export class ClientService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createNewClient(data: ClientInsertModel, tx?: Transaction) {
    const db = tx || this.databaseService.drizzle

    const [createdClient] = await db.insert(client).values(data).returning()

    return createdClient
  }
}
