import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { eq, and, isNotNull, sql } from 'drizzle-orm'
import {
  DatabaseService,
  userProfile,
  UserProfileInsertModel,
  UserProfileSelectModel,
  Transaction,
  staffMember,
  client,
  trainingSignup,
} from '@app/infrastructure/database'
import { RedisCacheService, UserProfileCacheKey } from '@app/infrastructure/redis'
import { TypedConfigService } from '@app/infrastructure/config'
import { DATE_FORMAT, PassStatusEnum, UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { ClientService } from '../client/client.service'
import { PassService } from '../pass/pass.service'
import { IVerifyClientSceneState } from '@app/bot/stage/scenes/verify-client/verify-client.scene-helper'
import { StaffMemberService } from '../staff-member'
import { UserProfileWithRoleRelations } from '@app/bot/libs'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'

@Injectable()
export class UserProfileService {
  private readonly studioId: string
  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly redisCacheService: RedisCacheService,
    private readonly databaseService: DatabaseService,
    private readonly configService: TypedConfigService,
    private readonly clientService: ClientService,
    private readonly staffMemberService: StaffMemberService,
    private readonly passService: PassService,
  ) {
    this.studioId = this.configService.get('STUDIO_ID')
  }

  async findStudioAdmins() {
    return await this.databaseService.drizzle.query.userProfile.findMany({
      where: (userProfile, { eq, and }) =>
        and(
          eq(userProfile.studioId, this.studioId),
          eq(userProfile.role, UserProfileRoleEnum.ADMIN),
          eq(userProfile.status, UserProfileStatusEnum.ACTIVE),
        ),
    })
  }

  async findTelegramAuthenticatedUser(telegramId: string, username?: string) {
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
                status: true,
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

    const userProfileCashed = await this.redisCacheService.get<typeof userProfileFound>(cacheKey)
    if (userProfileCashed) {
      return userProfileCashed
    }

    const userProfileFound = await this.databaseService.drizzle.query.userProfile.findFirst({
      where: (userProfile, { and, eq }) => and(...Object.entries(conditions).map(([key, value]) => eq(userProfile[key], value))),
      with: {
        staffMember: true,
        client: true,
      },
    })

    if (userProfileFound) {
      this.redisCacheService.set(cacheKey, userProfileFound)
    }
    return userProfileFound
  }

  async getUserProfileById(id: string): Promise<UserProfileWithRoleRelations> {
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
    const [user] = await dbProvider.update(userProfile).set(data).where(eq(userProfile.id, id)).returning()
    await this.redisCacheService.reset()
    return user
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
    this.updateUserProfile(id, { status: UserProfileStatusEnum.UNVERIFIED, role: UserProfileRoleEnum.GUEST })
    return true
  }

  async rejectVerificationRequestAndBlockUser(id: string) {
    this.updateUserProfile(id, { status: UserProfileStatusEnum.BLOCKED, role: UserProfileRoleEnum.GUEST })
    return true
  }

  async verifyClient(data: IVerifyClientSceneState) {
    const { userProfile, passTemplate, saleDate } = data

    const user = await this.getUserProfileById(userProfile.id)

    if (user.role !== UserProfileRoleEnum.CLIENT || user.status !== UserProfileStatusEnum.VERIFICATION_REQUESTED) {
      return false
    }

    await this.databaseService.drizzle.transaction(async (tx) => {
      const client = await this.clientService.createNewClient({ userProfileId: userProfile.id }, tx)
      await Promise.all([
        this.passService.createNewPass(
          {
            clientId: client.id,
            saleDate,
            passTemplateId: passTemplate.id,
            status: PassStatusEnum.ACTIVE,
            availableSlots: passTemplate.length,
          },
          tx,
        ),
        this.updateUserProfile(
          data.userProfile.id,
          {
            status: UserProfileStatusEnum.ACTIVE,
          },
          tx,
        ),
      ])
    })
    return true
  }

  async verifyClientWithoutPass(userProfileId: string) {
    const user = await this.getUserProfileById(userProfileId)
    if (user.role !== UserProfileRoleEnum.CLIENT || user.status !== UserProfileStatusEnum.VERIFICATION_REQUESTED) {
      return false
    }
    await this.databaseService.drizzle.transaction(async (tx) => {
      await Promise.all([
        this.updateUserProfile(userProfileId, { status: UserProfileStatusEnum.ACTIVE }, tx),
        this.clientService.createNewClient({ userProfileId }, tx),
      ])
    })
    return true
  }

  async verifyTrainer(userProfileId: string) {
    const user = await this.getUserProfileById(userProfileId)
    if (user.role !== UserProfileRoleEnum.TRAINER || user.status !== UserProfileStatusEnum.VERIFICATION_REQUESTED) {
      return false
    }

    await this.databaseService.drizzle.transaction(async (tx) => {
      await Promise.all([
        this.staffMemberService.createOne({ userProfileId }, tx),
        this.updateUserProfile(userProfileId, { status: UserProfileStatusEnum.ACTIVE }, tx),
      ])
    })

    return true
  }

  async consentToRules(userId: string) {
    const user = await this.getUserProfileById(userId)
    if (user.consentToRules) {
      return false
    }

    await this.updateUserProfile(userId, { consentToRules: true })
    return true
  }

  async findUsersProfilesByConditions(conditions: Partial<UserProfileSelectModel> = {}) {
    return this.databaseService.drizzle.query.userProfile.findMany({
      where: (userProfile, { and, eq }) =>
        and(
          eq(userProfile.studioId, this.studioId),
          ...Object.entries(conditions).map(([key, value]) => eq(userProfile[key], value)),
        ),
    })
  }

  async findUsersWithBirthdayToday() {
    const today = new Date()
    const month = today.getMonth() + 1
    const day = today.getDate()

    return this.databaseService.drizzle
      .select()
      .from(userProfile)
      .where(
        and(
          eq(userProfile.studioId, this.studioId),
          eq(userProfile.status, UserProfileStatusEnum.ACTIVE),
          isNotNull(userProfile.dateOfBirth),
          sql`EXTRACT(MONTH FROM ${userProfile.dateOfBirth}) = ${month}`,
          sql`EXTRACT(DAY FROM ${userProfile.dateOfBirth}) = ${day}`,
        ),
      )
  }

  async findWildcardClients(query: string) {
    const sanitizedQuery = query.trim().toLowerCase()

    if (sanitizedQuery.length < 2) {
      return []
    }

    return this.databaseService.drizzle.query.userProfile.findMany({
      where: (userProfile, { and, eq, or, ilike }) =>
        and(
          eq(userProfile.studioId, this.studioId),
          eq(userProfile.role, UserProfileRoleEnum.CLIENT),
          eq(userProfile.status, UserProfileStatusEnum.ACTIVE),
          or(
            ilike(userProfile.firstName, `%${sanitizedQuery}%`),
            ilike(userProfile.lastName, `%${sanitizedQuery}%`),
            ilike(userProfile.fullName, `%${sanitizedQuery}%`),
            ilike(userProfile.phoneNumber, `%${sanitizedQuery}%`),
          ),
        ),
      orderBy: (userProfile, { asc }) => asc(userProfile.firstName),
    })
  }

  async getAllActiveStaffMembersUserProfiles() {
    const studioId = this.configService.get('STUDIO_ID')
    const cacheKey = UserProfileCacheKey.allStudioStaffMembers(studioId)

    const staffMembersCashed = await this.redisCacheService.get<typeof staffMembers>(cacheKey)
    if (staffMembersCashed) {
      return staffMembersCashed
    }

    const staffMembers = await this.databaseService.drizzle.query.userProfile.findMany({
      where: (userProfile, { eq, and, or, exists }) =>
        and(
          eq(userProfile.studioId, studioId),
          or(eq(userProfile.role, UserProfileRoleEnum.TRAINER), eq(userProfile.role, UserProfileRoleEnum.ADMIN)),
          eq(userProfile.status, UserProfileStatusEnum.ACTIVE),
          exists(this.databaseService.drizzle.select().from(staffMember).where(eq(staffMember.userProfileId, userProfile.id))),
        ),
      with: {
        staffMember: true,
      },
    })

    this.redisCacheService.set(cacheKey, staffMembers)
    return staffMembers
  }

  async expireAllPastPasses() {
    const now = new Date()
    const todayDateString = this.dateTimeProvider.formatDateStringInTz(now.toISOString(), DATE_FORMAT.DATE_MAIN)

    const expiredPasses = await this.databaseService.drizzle.query.pass.findMany({
      where: (pass, { and, lt }) => and(eq(pass.status, PassStatusEnum.ACTIVE), lt(pass.endDate, todayDateString)),
    })
    if (expiredPasses.length) {
      await this.databaseService.drizzle.transaction(async (tx) => {
        for (const pass of expiredPasses) {
           await this.passService.updatePass(pass.id, { status: PassStatusEnum.EXPIRED }, tx)
        }
      })
      await this.redisCacheService.reset()
    }
    return expiredPasses
  }

  async getClientsUserProfiles({ withArchived = false } = {}) {
    const studioId = this.configService.get('STUDIO_ID')
    const cacheKey = UserProfileCacheKey.allStudioClients(studioId, withArchived)

    const clientsCashed = await this.redisCacheService.get<typeof clients>(cacheKey)
    if (clientsCashed) {
      return clientsCashed
    }

    const statusConditions = withArchived
      ? [UserProfileStatusEnum.ACTIVE, UserProfileStatusEnum.ARCHIVED]
      : [UserProfileStatusEnum.ACTIVE]

    const clients = await this.databaseService.drizzle.query.userProfile.findMany({
      where: (userProfile, { eq, and, exists, or }) =>
        and(
          eq(userProfile.studioId, studioId),
          eq(userProfile.role, UserProfileRoleEnum.CLIENT),
          or(...statusConditions.map((status) => eq(userProfile.status, status))),
          exists(this.databaseService.drizzle.select().from(client).where(eq(client.userProfileId, userProfile.id))),
        ),
      with: {
        client: {
          with: {
            pass: true,
          },
        },
      },
    })

    this.redisCacheService.set(cacheKey, clients)
    return clients
  }

  async getActiveClientsForSignIn(trainingId: number) {
    const studioId = this.configService.get('STUDIO_ID')

    const cacheKey = UserProfileCacheKey.activeClientsForSignIn(studioId, trainingId)

    const cachedClients = await this.redisCacheService.get<typeof clients>(cacheKey)
    if (cachedClients) {
      return cachedClients
    }

    const clients = await this.databaseService.drizzle.query.userProfile.findMany({
      where: (userProfile, { eq, and, exists, notExists }) =>
        and(
          eq(userProfile.studioId, this.studioId),
          eq(userProfile.role, UserProfileRoleEnum.CLIENT),
          eq(userProfile.status, UserProfileStatusEnum.ACTIVE),
          exists(this.databaseService.drizzle.select().from(client).where(eq(client.userProfileId, userProfile.id))),
          notExists(
            this.databaseService.drizzle
              .select()
              .from(trainingSignup)
              .where(and(eq(trainingSignup.userProfileId, userProfile.id), eq(trainingSignup.trainingId, trainingId))),
          ),
        ),
      with: {
        client: {
          with: {
            pass: true,
          }
        },
      },
    })

    this.redisCacheService.set(cacheKey, clients)
    return clients
  }
}
