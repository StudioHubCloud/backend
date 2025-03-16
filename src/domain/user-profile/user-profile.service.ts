import { DatabaseService, userProfile, UserProfileInsertModel, UserProfileSelectModel } from '@app/infrastructure/database'
import { Transaction } from '@app/infrastructure/database/database.module'
import { Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'

@Injectable()
export class UserProfileService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getUserProfileById(id: string) {
    return this.databaseService.drizzle.query.userProfile.findFirst({ where: (userProfile, { eq }) => eq(userProfile.id, id) })
  }
  async findUserProfileByCondition(data: Partial<UserProfileSelectModel>) {
    const conditions = Object.entries(data).map(([key, value]) => eq(userProfile[key], value))
    return this.databaseService.drizzle.query.userProfile.findFirst({
      where: and(...conditions),
    })
  }

  async createUserProfile(data: UserProfileInsertModel, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle
    return dbProvider.insert(userProfile).values(data).returning()
  }
}
