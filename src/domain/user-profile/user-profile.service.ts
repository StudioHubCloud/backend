import { Injectable, NotFoundException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import {
  DatabaseService,
  userProfile,
  UserProfileInsertModel,
  UserProfileSelectModel,
  Transaction,
} from '@app/infrastructure/database'
import { RedisCacheService, UserProfileCacheKey } from '@app/infrastructure/redis'
import { TypedConfigService } from '@app/infrastructure/config'

@Injectable()
export class UserProfileService {
  private readonly studioId: string
  constructor(
    private readonly redisCacheService: RedisCacheService,
    private readonly databaseService: DatabaseService,
    private readonly configService: TypedConfigService,
  ) {
    this.studioId = this.configService.get('STUDIO_ID')
  }

  async findTelegramAuthenticatedUser(telegramId: string) {
    const cacheKey = UserProfileCacheKey.telegramAuthUser(this.studioId, telegramId)
    const authUserCashed = await this.redisCacheService.get<typeof authUserFound>(cacheKey)
    if (authUserCashed) {
      return authUserCashed
    }

    const authUserFound = await this.databaseService.drizzle.query.userProfile.findFirst({
      where: (userProfile, { eq, and }) => and(eq(userProfile.telegramId, telegramId), eq(userProfile.studioId, this.studioId)),
      with: {
        client: {
          with: {
            pass: {
              columns: {
                id: true,
                groupId: true,
              },
            },
          },
        },
      },
    })

    if (authUserFound) {
      this.redisCacheService.set(cacheKey, authUserFound)
    }
    return authUserFound
  }

  async findUserProfileByCondition(conditions: Partial<UserProfileSelectModel>) {
    const cacheKey = UserProfileCacheKey.userProfileByConditions(conditions)

    const userProfileCashed = await this.redisCacheService.get<UserProfileSelectModel>(cacheKey)
    if (userProfileCashed) {
      return userProfileCashed
    }

    const userProfileFound = await this.databaseService.drizzle.query.userProfile.findFirst({
      where: (userProfile, { and, eq }) => and(...Object.entries(conditions).map(([key, value]) => eq(userProfile[key], value))),
    })

    if (userProfileFound) {
      this.redisCacheService.set(cacheKey, userProfileFound)
    }
    return userProfileFound
  }

  async getUserProfileById(id: string) {
    const user = await this.findUserProfileByCondition({ id })
    if (!user) {
      throw new NotFoundException(`User with id: ${id} not found`)
    }
    return user
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
