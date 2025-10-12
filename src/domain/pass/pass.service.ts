import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, inArray } from 'drizzle-orm'
import { add, addDays, subDays } from 'date-fns'
import { TypedConfigService } from '@app/infrastructure/config'
import { PinoLogger } from 'nestjs-pino'
import {
  DatabaseService,
  pass,
  PassInsertModel,
  PassSelectModel,
  Transaction,
  userProfile,
  client,
} from '@app/infrastructure/database'
import { PassCacheKey, RedisCacheService } from '@app/infrastructure/redis'
import {
  DATE_FORMAT,
  PassActivationFileTypeEnum,
  PassActivationRequestTypeEnum,
  PassStatusEnum,
  UserProfileStatusEnum,
} from '@app/libs'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { PASS_CONFIG } from '@app/bot/libs'
import { PassActivationRequestService } from '../pass-activation-request'

@Injectable()
export class PassService {
  private studioId: string
  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
    private readonly redisCacheService: RedisCacheService,
    private readonly configService: TypedConfigService,
    private readonly passActivationRequestService: PassActivationRequestService,
  ) {
    this.studioId = this.configService.get('STUDIO_ID')
  }

  async createNewPass(data: Omit<PassInsertModel, 'studioId'>, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle
    const [createdPass] = await dbProvider
      .insert(pass)
      .values({ ...data, studioId: this.studioId })
      .returning()
    await this.redisCacheService.reset()
    return createdPass
  }

  async createPassWithActivationRequest(
    data: Omit<PassInsertModel, 'studioId'> & {
      fileId: string
      fileType: PassActivationFileTypeEnum
      type: PassActivationRequestTypeEnum
    },
  ) {
    const { fileId, fileType, clientId, type, ...passData } = data

    return await this.databaseService.drizzle.transaction(async (tx) => {
      const pass = await this.createNewPass({ ...passData, clientId }, tx)
      const ar = await this.passActivationRequestService.createActivationRequest(
        {
          passId: pass.id,
          studioId: this.studioId,
          clientId,
          fileId,
          fileType,
          type,
        },
        tx,
      )

      await this.redisCacheService.reset()
      return [pass, ar] as const
    })
  }

  async createNewPassForExistingClient(clientId: string, newPassData: PassInsertModel) {
    return await this.databaseService.drizzle.transaction(async (tx) => {
      const currentPass = await this.findActivePassByClientId(clientId, { withRequested: true })

      if (currentPass && currentPass.status === PassStatusEnum.REQUESTED) {
        throw new BadRequestException('Cannot create a new pass when there is a requested pass')
      }

      if (currentPass) {
        await this.updatePass(
          currentPass.id,
          {
            status: PassStatusEnum.EXPIRED,
          },
          tx,
        )
      }
      return await this.createNewPass(newPassData, tx)
    })
  }

  async activatePassesAfterGracePeriod() {
    const now = new Date()
    const todayDateString = this.dateTimeProvider.formatDateStringInTz(now.toISOString(), DATE_FORMAT.DATE_MAIN)
    const sevenDaysAgoString = this.dateTimeProvider.formatDateStringInTz(
      subDays(now, PASS_CONFIG.ACTIVATION_GRACE_PERIOD).toISOString(),
      DATE_FORMAT.DATE_MAIN,
    )

    const passesToActivate = await this.databaseService.drizzle.query.pass.findMany({
      where: (pass, { and, lte, isNull, eq, or }) =>
        and(
          eq(pass.status, PassStatusEnum.ACTIVE),
          or(isNull(pass.startDate), isNull(pass.endDate)),
          lte(pass.saleDate, sevenDaysAgoString),
        ),
      with: {
        passTemplate: true,
        client: {
          with: {
            userProfile: true,
          },
        },
      },
    })

    let count = 0

    if (passesToActivate.length) {
      const endDateString = this.dateTimeProvider.formatDateStringInTz(
        addDays(now, PASS_CONFIG.DEFAULT_DURATION_IN_DAYS).toISOString(),
        DATE_FORMAT.DATE_MAIN,
      )

      await this.databaseService.drizzle.transaction(async (tx) => {
        for (const pass of passesToActivate) {
          await this.updatePass(
            pass.id,
            {
              startDate: todayDateString,
              endDate: endDateString,
            },
            tx,
          )
          count++
          this.logger.debug(
            `Auto-activated pass ${pass.id} for client ${pass.client?.userProfile?.firstName} after 7-day grace period`,
          )
        }
      })

      await this.redisCacheService.reset()
    }
    return count
  }

  async findPassByConditions({ status, ...conditions }: Partial<PassSelectModel>, { withRequested = false } = {}) {
    const statusConditions = [status ?? null, withRequested ? PassStatusEnum.REQUESTED : null].filter((s) => s !== null)

    const whereConditions = [...Object.entries(conditions).map(([key, value]) => eq(pass[key], value))]

    if (statusConditions.length > 0) {
      whereConditions.push(inArray(pass.status, statusConditions))
    }

    const passFound = await this.databaseService.drizzle.query.pass.findFirst({
      where: (pass, { and }) => and(...whereConditions),
      with: {
        passTemplate: true,
      },
    })
    return passFound
  }

  async findActivePassByClientId(clientId?: string, { withExpired = false, withRequested = false } = {}) {
    if (!clientId) {
      return null
    }
    const cacheKey = PassCacheKey.passByClientId(clientId, this.studioId)
    const cachedPass = await this.redisCacheService.get<typeof pass>(cacheKey)

    if (cachedPass) {
      return cachedPass
    }
    const pass =
      (await this.findPassByConditions({ clientId, status: PassStatusEnum.ACTIVE, studioId: this.studioId }, { withRequested })) ??
      null

    if (!pass && withExpired) {
      const expiredPass = await this.findLastExpiredPassByClientId(clientId)
      if (expiredPass) {
        return expiredPass
      }
    }

    if (pass) {
      this.redisCacheService.set(cacheKey, pass)
    }

    return pass
  }

  async findLastExpiredPassByClientId(clientId: string) {
    if (!clientId) {
      return null
    }
    const pass = await this.databaseService.drizzle.query.pass.findFirst({
      where: (pass, { and, eq }) => and(eq(pass.clientId, clientId), eq(pass.status, PassStatusEnum.EXPIRED)),
      orderBy: (pass, { desc }) => desc(pass.endDate),
      with: {
        passTemplate: true,
      },
    })
    return pass || null
  }

  async updatePass(id: string, data: Partial<PassInsertModel>, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle
    const [updateResult] = await dbProvider.update(pass).set(data).where(eq(pass.id, id)).returning()
    const updatedPass = await this.findPassByConditions({ id: updateResult.id })

    if (!updatedPass) {
      throw new BadRequestException(`Pass with id ${id} not found`)
    }

    await this.redisCacheService.reset()
    return updatedPass
  }

  async getExpiringPassesInDays(days: number) {
    const now = new Date()
    const dateToCheck = add(now, { days: days }).toISOString()

    const todayDateString = this.dateTimeProvider.formatDateStringInTz(now.toISOString(), DATE_FORMAT.DATE_MAIN)
    const checkDateString = this.dateTimeProvider.formatDateStringInTz(dateToCheck, DATE_FORMAT.DATE_MAIN)

    return this.databaseService.drizzle.query.pass.findMany({
      where: (pass, { and, gte, lte, eq, exists }) =>
        and(
          gte(pass.endDate, todayDateString),
          lte(pass.endDate, checkDateString),
          eq(pass.status, PassStatusEnum.ACTIVE),
          eq(pass.reminderSent, false),
          exists(
            this.databaseService.drizzle
              .select()
              .from(client)
              .innerJoin(userProfile, eq(client.userProfileId, userProfile.id))
              .where(and(eq(client.id, pass.clientId), eq(userProfile.status, UserProfileStatusEnum.ACTIVE))),
          ),
        ),
      with: {
        client: {
          with: {
            userProfile: true,
          },
        },
      },
    })
  }

  async getPassById(id: string) {
    const cacheKey = PassCacheKey.passById(id, this.studioId)
    const cachedPass = await this.redisCacheService.get<typeof foundPass>(cacheKey)

    if (cachedPass) {
      return cachedPass
    }

    const foundPass = await this.databaseService.drizzle.query.pass.findFirst({
      where: (pass, { eq }) => eq(pass.id, id),
      with: {
        passTemplate: true,
        client: {
          with: {
            userProfile: true,
          },
        },
      },
    })

    if (foundPass) {
      this.redisCacheService.set(cacheKey, foundPass)
    }

    return foundPass
  }

  async activatePass(
    id: string,
    { withStatusChange }: { withStatusChange: boolean } = { withStatusChange: false },
    tx?: Transaction,
  ) {
    const passToActivate = await this.getPassById(id)

    if (!passToActivate) {
      throw new BadRequestException(`Pass with id ${id} not found`)
    }

    if (passToActivate.startDate && passToActivate.endDate) {
      throw new BadRequestException(`Pass with id ${id} is already activated`)
    }

    const todayDateString = this.dateTimeProvider.formatDateStringInTz(new Date().toISOString(), DATE_FORMAT.DATE_MAIN)
    const endDateString = this.dateTimeProvider.formatDateStringInTz(
      addDays(new Date(), PASS_CONFIG.DEFAULT_DURATION_IN_DAYS).toISOString(),
      DATE_FORMAT.DATE_MAIN,
    )

    return await this.updatePass(
      id,
      {
        saleDate: todayDateString,
        startDate: todayDateString,
        endDate: endDateString,
        ...(withStatusChange ? { status: PassStatusEnum.ACTIVE } : {}),
      },
      tx,
    )
  }

  async acceptPassActivateRequest(passId: string, passActivationRequestId: string, isRenewRequest: boolean) {
    const passToActivate = await this.getPassById(passId)
    if (!passToActivate) {
      throw new BadRequestException(`Pass with id ${passId} not found`)
    }

    if (passToActivate.status !== PassStatusEnum.REQUESTED) {
      throw new BadRequestException(`Pass with id ${passId} activation request is already processed`)
    }

    if (isRenewRequest) {
      await this.databaseService.drizzle
        .update(pass)
        .set({ status: PassStatusEnum.EXPIRED })
        .where(and(eq(pass.clientId, passToActivate.clientId), eq(pass.status, PassStatusEnum.ACTIVE)))
    }

    await this.databaseService.drizzle.transaction(async (tx) => {
      const todayDateString = this.dateTimeProvider.formatDateStringInTz(new Date().toISOString(), DATE_FORMAT.DATE_MAIN)
      await Promise.all([
        this.updatePass(passId, { saleDate: todayDateString, status: PassStatusEnum.ACTIVE }, tx),
        this.passActivationRequestService.deleteActivationRequest(passActivationRequestId, tx),
      ])
    })

    await this.redisCacheService.reset()
    return true
  }

  async deletePassById(id: string, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle
    const result = await dbProvider.delete(pass).where(eq(pass.id, id)).returning()

    if (result.length) {
      await this.redisCacheService.reset()
    }

    return true
  }

  async rejectPassActivateRequest(passId: string) {
    const passToReject = await this.getPassById(passId)
    if (!passToReject) {
      throw new BadRequestException(`Pass with id ${passId} not found`)
    }

    if (passToReject.status !== PassStatusEnum.REQUESTED) {
      throw new BadRequestException(`Pass with id ${passId} activation request is already processed`)
    }

    return await this.deletePassById(passId)
  }
}
