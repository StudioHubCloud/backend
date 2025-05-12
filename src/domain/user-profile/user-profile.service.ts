import { Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import {
  DatabaseService,
  userProfile,
  UserProfileInsertModel,
  UserProfileSelectModel,
  Transaction,
} from '@app/infrastructure/database'
import { RedisCacheService } from '@app/infrastructure/redis'
import { TypedConfigService } from '@app/infrastructure/config'
import { GLOBAL_CACHE_KEYS } from '@app/libs'

@Injectable()
export class UserProfileService {
  private readonly cashe_key = 'user_profile'
  constructor(
    private readonly redisCacheService: RedisCacheService,
    private readonly databaseService: DatabaseService,
    private readonly configService: TypedConfigService,
  ) {}

  async getUserProfileById(id: string) {
    return this.databaseService.drizzle.query.userProfile.findFirst({ where: (userProfile, { eq }) => eq(userProfile.id, id) })
  }

  async getTelegramAuthenticatedUser(telegramId: number) {
    const authUserCashed = await this.redisCacheService.get<UserProfileSelectModel>(GLOBAL_CACHE_KEYS.AUTH_USER)
    if (authUserCashed) {
      return authUserCashed
    }

    const authUserFound = await this.databaseService.drizzle.query.userProfile.findFirst({
      where: (userProfile, { eq, and }) =>
        and(eq(userProfile.telegramId, telegramId.toString()), eq(userProfile.studioId, this.configService.get('STUDIO_ID'))),
      with: {
        client: {
          columns: {
            id: true
          }
        }
      }
    })

    if (authUserFound) {
      await this.redisCacheService.set(GLOBAL_CACHE_KEYS.AUTH_USER, authUserFound)
    }
    return authUserFound
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
