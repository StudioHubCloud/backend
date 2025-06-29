import { BadRequestException, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { TypedConfigService } from '@app/infrastructure/config'
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
import { PassStatusEnum, UserProfileStatusEnum } from '@app/libs'
import { add } from 'date-fns'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'

@Injectable()
export class PassService {
  private studioId: string
  constructor(
    @DateTimeProviderInjector() private readonly dateTimeService: DateTimeProvider,
    private readonly databaseService: DatabaseService,
    private readonly redisCacheService: RedisCacheService,
    private readonly configService: TypedConfigService,
  ) {
    this.studioId = this.configService.get('STUDIO_ID')
  }

  async createNewPass(data: PassInsertModel, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle
    const [createdPass] = await dbProvider.insert(pass).values(data).returning()
    await this.redisCacheService.reset()
    return createdPass
  }

  async createNewPassForExistingClient(clientId: string, newPassData: PassInsertModel) {
    return await this.databaseService.drizzle.transaction(async (tx) => {
      const currentPass = await this.findActivePassByClientId(clientId)

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

  async expireAllPastPasses() {
    const now = new Date()
    const todayDateString = this.dateTimeService.formatDateStringInTz(now.toISOString(), 'yyyy-MM-dd')

    const expiredPasses = await this.databaseService.drizzle.query.pass.findMany({
      where: (pass, { and, lt }) => and(eq(pass.status, PassStatusEnum.ACTIVE), lt(pass.endDate, todayDateString)),
    })
    if (expiredPasses.length) {
      await this.databaseService.drizzle.transaction(async (tx) => {
        for (const pass of expiredPasses) {
          await this.updatePass(pass.id, { status: PassStatusEnum.EXPIRED }, tx)
        }
      })
      await this.redisCacheService.reset()
    }
    return expiredPasses
  }

  async findPassByConditions(conditions: Partial<PassSelectModel>) {
    const passFound = await this.databaseService.drizzle.query.pass.findFirst({
      where: (pass, { and, eq }) => and(...Object.entries(conditions).map(([key, value]) => eq(pass[key], value))),
      with: {
        passTemplate: true,
      },
    })
    return passFound
  }

  async findActivePassByClientId(clientId?: string, withExpired?: boolean) {
    if (!clientId) {
      return null
    }
    const cacheKey = PassCacheKey.passByClientId(clientId, this.studioId)
    const cachedPass = await this.redisCacheService.get<typeof pass>(cacheKey)

    if (cachedPass) {
      return cachedPass
    }
    const pass = (await this.findPassByConditions({ clientId, status: PassStatusEnum.ACTIVE, studioId: this.studioId })) ?? null

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

    await this.redisCacheService.set(PassCacheKey.passByClientId(updatedPass.clientId, this.studioId), updatedPass)
    return updatedPass
  }

  async getExpiringPassesInDays(days: number) {
    const now = new Date()
    const dateToCheck = add(now, { days: days }).toISOString()

    const todayDateString = this.dateTimeService.formatDateStringInTz(now.toISOString(), 'yyyy-MM-dd')
    const checkDateString = this.dateTimeService.formatDateStringInTz(dateToCheck, 'yyyy-MM-dd')

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
}
