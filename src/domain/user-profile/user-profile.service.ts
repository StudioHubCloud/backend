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
  PassSelectModel,
  userRegisterRequest,
  userProfileGuardian,
} from '@app/infrastructure/database'
import { RedisCacheService, UserProfileCacheKey } from '@app/infrastructure/redis'
import { TypedConfigService } from '@app/infrastructure/config'
import {
  AuditLogServiceOperation,
  DATE_FORMAT,
  FileTypeEnum,
  PassGroupModeEnum,
  PassStatusEnum,
  PassTemplateTypeEnum,
  UserProfileRoleEnum,
  UserProfileStatusEnum,
} from '@app/libs'
import { ClientService } from '../client/client.service'
import { PassService } from '../pass/pass.service'
import { IVerifyClientSceneState } from '@app/bot/stage/scenes/verify-client/verify-client.scene-helper'
import { IPassOpenSceneState } from '@app/bot/stage/scenes/pass/pass-open.scene-helper'
import { StaffMemberService } from '../staff-member'
import { TNotificationRecipient, UserProfileWithRoleRelations } from '@app/bot/libs'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'

/** Staff always log in with Telegram; only a parent's child has none. Narrows the type for senders. */
export const hasTelegram = <T extends { telegramId: string | null }>(profile: T): profile is T & { telegramId: string } =>
  !!profile.telegramId

/**
 * Relations of the authenticated user (`AuthUserProfile`); a child the parent acts for is loaded the same way.
 * `children`: the parent's links (child status only) — «👨‍👩‍👧 Мої діти» in the main menu, without an extra query.
 */
const AUTH_USER_WITH = {
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
  children: { columns: { childProfileId: true }, with: { child: { columns: { status: true } } } },
} as const

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
    this.studioId = this.configService.getStudioId()
  }

  /** Active admins of the studio; `withMaintainers` adds the maintainers (e.g. in the test studio, which has no admin). */
  async findStudioAdmins({ withMaintainers = false }: { withMaintainers?: boolean } = {}) {
    const roles = withMaintainers ? [UserProfileRoleEnum.ADMIN, UserProfileRoleEnum.MAINTAINER] : [UserProfileRoleEnum.ADMIN]
    const admins = await this.databaseService.drizzle.query.userProfile.findMany({
      where: (userProfile, { eq, and, inArray }) =>
        and(
          eq(userProfile.studioId, this.studioId),
          inArray(userProfile.role, roles),
          eq(userProfile.status, UserProfileStatusEnum.ACTIVE),
          isNotNull(userProfile.telegramId),
        ),
    })
    return admins.filter(hasTelegram)
  }

  /**
   * Who gets client requests (registration, a child's registration, pass payment): the admins; in the test studio (no
   * admin there) the maintainers too, like the other admin notices (`!isProduction()`).
   */
  async findRequestReviewers() {
    return this.findStudioAdmins({ withMaintainers: !this.configService.isProduction() })
  }

  async findTelegramAuthenticatedUser(telegramId: string, username?: string) {
    const cacheKey = UserProfileCacheKey.telegramAuthUser(this.studioId, telegramId)
    const authUserCashed = await this.redisCacheService.get<typeof authUserFound>(cacheKey)
    if (authUserCashed) {
      return authUserCashed
    }

    const authUserFound = await this.databaseService.drizzle.query.userProfile.findFirst({
      where: (userProfile, { eq, and }) => and(eq(userProfile.telegramId, telegramId), eq(userProfile.studioId, this.studioId)),
      with: AUTH_USER_WITH,
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

  /** The client's profile (this studio's) by client id, e.g. from a pass. */
  async getUserProfileByClientId(clientId: string) {
    const found = await this.databaseService.drizzle.query.client.findFirst({
      where: (c, { eq }) => eq(c.id, clientId),
      columns: { userProfileId: true },
    })
    return found ? this.findUserProfileByCondition({ id: found.userProfileId, studioId: this.studioId }) : null
  }

  async createUserProfile(data: UserProfileInsertModel, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle
    const [createdUser] = await dbProvider.insert(userProfile).values(data).returning()
    // Cached only for a Telegram login (a child without Telegram never authenticates)
    if (createdUser && data.telegramId) {
      this.redisCacheService.set(UserProfileCacheKey.telegramAuthUser(this.studioId, data.telegramId), createdUser)
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
          // A parent registered together with a child is approved with the child's request (one request, the parent in it)
          sql`not exists (
            select 1 from user_profile_guardian g join user_profile c on c.id = g.child_profile_id
            where g.guardian_profile_id = ${userProfile.id} and c.status = ${UserProfileStatusEnum.VERIFICATION_REQUESTED}
          )`,
        ),
    })
  }

  async rejectVerificationRequest(id: string) {
    await this.updateUserProfile(id, { status: UserProfileStatusEnum.UNVERIFIED, role: UserProfileRoleEnum.GUEST })
    return true
  }

  async rejectVerificationRequestAndBlockUser(id: string) {
    await this.updateUserProfile(id, { status: UserProfileStatusEnum.BLOCKED, role: UserProfileRoleEnum.GUEST })
    return true
  }

  /**
   * A client's registration request: the group picked at registration (and the payment file), read on verification.
   * One per user: a repeated registration replaces the previous request.
   */
  async saveRegisterRequest(data: {
    userProfileId: string
    groupId: number | null
    fileId: string | null
    fileType: FileTypeEnum | null
  }) {
    return this.databaseService.drizzle.transaction(async (tx) => {
      await tx.delete(userRegisterRequest).where(eq(userRegisterRequest.userProfileId, data.userProfileId))
      const [row] = await tx
        .insert(userRegisterRequest)
        .values({ ...data, studioId: this.studioId })
        .returning()
      return row
    })
  }

  async getRegisterRequest(userProfileId: string) {
    return this.databaseService.drizzle.query.userRegisterRequest.findFirst({
      where: (request, { and, eq }) => and(eq(request.userProfileId, userProfileId), eq(request.studioId, this.studioId)),
    })
  }

  /** The parent's children (linked in `user_profile_guardian`), oldest link first. */
  async findChildren(guardianId: string) {
    const links = await this.databaseService.drizzle.query.userProfileGuardian.findMany({
      where: (link, { and, eq }) => and(eq(link.guardianProfileId, guardianId), eq(link.studioId, this.studioId)),
      with: { child: { with: AUTH_USER_WITH } },
      orderBy: (link, { asc }) => [asc(link.createdAt)],
    })
    return links.map((link) => link.child)
  }

  /** The child only when it is linked to this parent in this studio: callback data and a stale acting id are not trusted. */
  async findChildOfGuardian(guardianId: string, childId: string) {
    const link = await this.databaseService.drizzle.query.userProfileGuardian.findFirst({
      where: (link, { and, eq }) =>
        and(eq(link.guardianProfileId, guardianId), eq(link.childProfileId, childId), eq(link.studioId, this.studioId)),
      with: { child: { with: AUTH_USER_WITH } },
    })
    return link?.child ?? null
  }

  /** "Мої діти": the parent acts for this child from now on, or for themselves (`null`). False: not their child. */
  async setActingProfile(guardianId: string, childId: string | null) {
    if (childId && !(await this.findChildOfGuardian(guardianId, childId))) {
      return false
    }
    await this.databaseService.drizzle
      .update(userProfile)
      .set({ actingProfileId: childId })
      .where(and(eq(userProfile.id, guardianId), eq(userProfile.studioId, this.studioId)))
    await this.redisCacheService.reset()
    return true
  }

  /**
   * A child registered by a parent: CLIENT profile without Telegram and phone, waiting for the admin, linked to the parent,
   * plus its registration request (group, payment file). The client row is created on verification, as for any client.
   * The registration request carries the payment; the admin approves parent + child in one go (`activatePendingGuardians`).
   */
  async createChildProfile(data: {
    guardianId: string
    firstName: string
    lastName?: string | null
    fullName: string
    dateOfBirth: string
    groupId: number | null
    fileId: string | null
    fileType: FileTypeEnum | null
    /** A parent registering together with the child (start screen): their own profile update, in the same transaction */
    guardianUpdate?: Partial<UserProfileInsertModel>
  }) {
    const { guardianId, groupId, fileId, fileType, guardianUpdate, ...profile } = data
    const child = await this.databaseService.drizzle.transaction(async (tx) => {
      if (guardianUpdate) {
        await tx
          .update(userProfile)
          .set(guardianUpdate)
          .where(and(eq(userProfile.id, guardianId), eq(userProfile.studioId, this.studioId)))
      }
      const [created] = await tx
        .insert(userProfile)
        .values({
          ...profile,
          fileId,
          fileType,
          telegramId: null,
          phoneNumber: null,
          role: UserProfileRoleEnum.CLIENT,
          status: UserProfileStatusEnum.VERIFICATION_REQUESTED,
          trial_discount: false,
          studioId: this.studioId,
        })
        .returning()
      await tx.insert(userProfileGuardian).values({ guardianProfileId: guardianId, childProfileId: created.id, studioId: this.studioId })
      await tx.insert(userRegisterRequest).values({ userProfileId: created.id, groupId, fileId, fileType, studioId: this.studioId })
      return created
    })
    await this.redisCacheService.reset()
    return child
  }

  /** The child's parents in this studio (the admin's request shows them; pack approval acts on the waiting ones). */
  async findGuardians(childId: string) {
    const links = await this.databaseService.drizzle.query.userProfileGuardian.findMany({
      where: (link, { and, eq }) => and(eq(link.childProfileId, childId), eq(link.studioId, this.studioId)),
      with: { guardian: true },
      orderBy: (link, { asc }) => [asc(link.createdAt)],
    })
    return links.map((link) => link.guardian)
  }

  /**
   * Main menu of a parent («👤 Профіль: Я» / «🧒 Профіль: Ліля»), for menus sent by others (notifications, broadcast):
   * null = not a parent (no child approved or waiting).
   */
  async getParentMenu(profileId: string) {
    return (await this.getParentMenus([profileId])).get(profileId) ?? null
  }

  /** `getParentMenu` for these profiles (or the whole studio) in one query: parent id → the name of the acting child. */
  async getParentMenus(profileIds?: string[]) {
    const links = await this.databaseService.drizzle.query.userProfileGuardian.findMany({
      where: (link, { and, eq, inArray }) =>
        and(eq(link.studioId, this.studioId), ...(profileIds ? [inArray(link.guardianProfileId, profileIds)] : [])),
      columns: { guardianProfileId: true },
      with: {
        guardian: { columns: { actingProfileId: true } },
        child: { columns: { id: true, status: true, firstName: true } },
      },
    })
    const menus = new Map<string, { actingName: string | null }>()
    for (const { guardianProfileId, guardian, child } of links) {
      if (child.status !== UserProfileStatusEnum.ACTIVE && child.status !== UserProfileStatusEnum.VERIFICATION_REQUESTED) {
        continue
      }
      const menu = menus.get(guardianProfileId) ?? { actingName: null }
      if (guardian.actingProfileId === child.id && child.status === UserProfileStatusEnum.ACTIVE) {
        menu.actingName = child.firstName
      }
      menus.set(guardianProfileId, menu)
    }
    return menus
  }

  /** Admin client card: the profile's parents (a child) and children (a parent). */
  async getFamily(profileId: string) {
    const [parents, children] = await Promise.all([this.findGuardians(profileId), this.findChildren(profileId)])
    return { parents, children }
  }

  /**
   * The child's request approved: parents who registered together with it and still wait become clients (without a
   * pass), so parent + child need one approval. They registered for the child, so they act for it from the start
   * (call after the child itself is verified). Returns the parents activated now.
   */
  async activatePendingGuardians(childId: string) {
    const pending = (await this.findGuardians(childId)).filter((g) => g.status === UserProfileStatusEnum.VERIFICATION_REQUESTED)
    for (const guardian of pending) {
      await this.verifyClientWithoutPass(guardian.id)
      await this.setActingProfile(guardian.id, childId)
    }
    return pending
  }

  /** The child's request rejected (or the child blocked): parents still waiting go back to the start and may register again. */
  async rejectPendingGuardians(childId: string) {
    const pending = (await this.findGuardians(childId)).filter((g) => g.status === UserProfileStatusEnum.VERIFICATION_REQUESTED)
    for (const guardian of pending) {
      await this.rejectVerificationRequest(guardian.id)
    }
    return pending
  }

  /**
   * Where a message meant for this profile goes: its own Telegram, otherwise to its parents (a child without Telegram).
   * `asGuardian`: the text is about the child and goes without the client keyboard.
   */
  async getNotificationRecipients(
    profile: Pick<UserProfileSelectModel, 'id' | 'telegramId'>,
  ): Promise<TNotificationRecipient[]> {
    if (profile.telegramId) {
      return [{ chatId: profile.telegramId, asGuardian: false }]
    }
    const links = await this.databaseService.drizzle.query.userProfileGuardian.findMany({
      where: (link, { and, eq }) => and(eq(link.childProfileId, profile.id), eq(link.studioId, this.studioId)),
      with: { guardian: { columns: { telegramId: true } } },
    })
    return links.flatMap(({ guardian }) => (guardian.telegramId ? [{ chatId: guardian.telegramId, asGuardian: true }] : []))
  }

  async verifyClient(data: IVerifyClientSceneState | IPassOpenSceneState): Promise<[boolean, AuditLogServiceOperation[]]> {
    const { userProfile, passTemplate, saleDate } = data
    const groupId = 'groupId' in data ? (data.groupId ?? null) : null

    // A FIXED group pass is always bound to a group (the scene asks for it)
    if (passTemplate.type === PassTemplateTypeEnum.GROUP && passTemplate.groupMode === PassGroupModeEnum.FIXED && !groupId) {
      throw new BadRequestException('A FIXED group pass needs a group')
    }

    const user = await this.getUserProfileById(userProfile.id)

    if (user.role !== UserProfileRoleEnum.CLIENT || user.status !== UserProfileStatusEnum.VERIFICATION_REQUESTED) {
      return [false, []]
    }

    const auditLogOperations = await this.databaseService.drizzle.transaction(async (tx) => {
      const client = await this.clientService.createNewClient({ userProfileId: userProfile.id }, tx)
      const [passResponse, userProfileResponse] = await Promise.all([
        this.passService.createNewPass(
          {
            clientId: client.id,
            saleDate,
            passTemplateId: passTemplate.id,
            status: PassStatusEnum.ACTIVE,
            availableSlots: passTemplate.length,
            groupMode: passTemplate.groupMode,
            groupId,
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
      return [...passResponse[1]]
    })

    const allOperationsWithMeta = auditLogOperations.map((op) => ({
      ...op,
      metadata: { serviceName: UserProfileService.name, methodName: this.verifyClient.name },
    }))

    return [true, allOperationsWithMeta]
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
    const cacheKey = UserProfileCacheKey.allStudioStaffMembers(this.studioId)

    const staffMembersCashed = await this.redisCacheService.get<typeof staffMembers>(cacheKey)
    if (staffMembersCashed) {
      return staffMembersCashed
    }

    const found = await this.databaseService.drizzle.query.userProfile.findMany({
      where: (userProfile, { eq, and, or, exists }) =>
        and(
          eq(userProfile.studioId, this.studioId),
          or(eq(userProfile.role, UserProfileRoleEnum.TRAINER), eq(userProfile.role, UserProfileRoleEnum.ADMIN)),
          eq(userProfile.status, UserProfileStatusEnum.ACTIVE),
          exists(this.databaseService.drizzle.select().from(staffMember).where(eq(staffMember.userProfileId, userProfile.id))),
        ),
      with: {
        staffMember: true,
      },
    })
    const staffMembers = found.filter(hasTelegram)

    this.redisCacheService.set(cacheKey, staffMembers)
    return staffMembers
  }

  async expireAllPastPasses(): Promise<[PassSelectModel[], AuditLogServiceOperation[]]> {
    const now = new Date()
    const todayDateString = this.dateTimeProvider.formatDateStringInTz(now.toISOString(), DATE_FORMAT.DATE_MAIN)
    const logOperations: AuditLogServiceOperation[] = []

    const expiredPasses = await this.databaseService.drizzle.query.pass.findMany({
      where: (pass, { and, lt }) =>
        and(eq(pass.studioId, this.studioId), eq(pass.status, PassStatusEnum.ACTIVE), lt(pass.endDate, todayDateString)),
    })
    if (expiredPasses.length) {
      await this.databaseService.drizzle.transaction(async (tx) => {
        for (const pass of expiredPasses) {
          const [_, updateLogOperation] = await this.passService.updatePass(pass.id, { status: PassStatusEnum.EXPIRED }, tx)
          logOperations.push(...updateLogOperation)
        }
      })
      await this.redisCacheService.reset()
    }

    const allOperationsWithMeta = logOperations.map((op) => ({
      ...op,
      metadata: { serviceName: UserProfileService.name, methodName: this.expireAllPastPasses.name },
    }))
    return [expiredPasses, allOperationsWithMeta]
  }

  async getClientsUserProfiles({ withArchived = false } = {}) {
    const cacheKey = UserProfileCacheKey.allStudioClients(this.studioId, withArchived)

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
          eq(userProfile.studioId, this.studioId),
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
    const cacheKey = UserProfileCacheKey.activeClientsForSignIn(this.studioId, trainingId)

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
          },
        },
      },
    })

    this.redisCacheService.set(cacheKey, clients)
    return clients
  }
}
