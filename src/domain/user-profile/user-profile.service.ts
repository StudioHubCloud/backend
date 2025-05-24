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
import { UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'

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
    const cacheKey = UserProfileCacheKey.telegramAuthUser(this.studioId, data.telegramId)
    const dbProvider = tx || this.databaseService.drizzle
    const [createdUser] = await dbProvider.insert(userProfile).values(data).returning()
    if (createdUser) {
      this.redisCacheService.set(cacheKey, createdUser)
    }
    return createdUser
  }

  async updateUserProfile(id: string, data: Partial<UserProfileInsertModel>, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle
    return dbProvider.update(userProfile).set(data).where(eq(userProfile.id, id)).returning()
  }

  async getVerificationRequestedUsers() {
    return await this.databaseService.drizzle.query.userProfile.findMany({
      where: (userProfile, { eq, and, or }) =>
        and(
          eq(userProfile.studioId, this.studioId),
          eq(userProfile.status, UserProfileStatusEnum.VERIFICATION_REQUESTED),
          or(eq(userProfile.role, UserProfileRoleEnum.CLIENT), eq(userProfile.role, UserProfileRoleEnum.TRAINER)),
        ),
    })
  }

  async rejectVerificationRequest(id: string) {
    await this.updateUserProfile(id, { status: UserProfileStatusEnum.UNVERIVIED, role: UserProfileRoleEnum.GUEST })
    this.redisCacheService.reset()
  }

  async rejectVerificationRequestAndBlockUser(id: string) {
    await this.updateUserProfile(id, { status: UserProfileStatusEnum.BLOCKED, role: UserProfileRoleEnum.GUEST })
    this.redisCacheService.reset()
  }
}
