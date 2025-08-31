import { DatabaseService, staffMember, Transaction } from '@app/infrastructure/database'
import { Injectable } from '@nestjs/common'

@Injectable()
export class StaffMemberService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createOne(data: { userProfileId: string }, tx?: Transaction) {
    const db = tx || this.databaseService.drizzle
    const [createdTrainer] = await db.insert(staffMember).values(data).returning()
    return createdTrainer
  }
}
