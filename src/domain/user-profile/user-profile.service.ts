import { Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { DatabaseService, userProfile, UserProfileInsertModel, UserProfileSelectModel, Transaction } from '@app/infrastructure/database'
import { RedisCacheService } from '@app/infrastructure/redis'

@Injectable()
export class UserProfileService {
  private readonly cashe_key = 'user_profile'
  constructor(
    private readonly redisCacheService: RedisCacheService,
    private readonly databaseService: DatabaseService,
  ) {}

  async getUserProfileById(id: string) {
    return this.databaseService.drizzle.query.userProfile.findFirst({ where: (userProfile, { eq }) => eq(userProfile.id, id) })
  }

  findUserForAuthTelegram({telegramId}) {
    //implement this with cache key factory 
  }

  async findUserProfileByCondition(conditions: Partial<UserProfileSelectModel>) {
    const cacheKey = `${this.cashe_key}:${JSON.stringify(conditions)}`

    const userProfileCashed = await this.redisCacheService.get<UserProfileSelectModel>(cacheKey)
    if (userProfileCashed) {
      return userProfileCashed
    }

    const userProfileFound = await this.databaseService.drizzle.query.userProfile.findFirst({
      where: and(...Object.entries(conditions).map(([key, value]) => eq(userProfile[key], value))),
    })

    if (userProfileFound) {
      await this.redisCacheService.set(cacheKey, userProfileFound)
    }
    return userProfileFound
  }

  async createUserProfile(data: UserProfileInsertModel, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle
    return dbProvider.insert(userProfile).values(data).returning()
  }

  async updateUserProfile(id: string, data: Partial<UserProfileInsertModel>, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle
    return dbProvider.update(userProfile).set(data).where(eq(userProfile.id, id)).returning()
  }
}
