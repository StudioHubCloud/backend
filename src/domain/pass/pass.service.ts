import { DatabaseService, pass, PassInsertModel, PassSelectModel, Transaction } from '@app/infrastructure/database'
import { PassCacheKey, RedisCacheService } from '@app/infrastructure/redis'
import { PassStatusEnum } from '@app/libs'
import { BadRequestException, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'

@Injectable()
export class PassService {

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async findPassByConditions(conditions: Partial<PassSelectModel>, options: { throwError?: boolean } = {}) {
    const { throwError = true } = options
    const passFound = await this.databaseService.drizzle.query.pass.findFirst({
      where: (pass, { and, eq }) => and(...Object.entries(conditions).map(([key, value]) => eq(pass[key], value))),
    })

    if (!passFound && throwError) {
      throw new BadRequestException('Користувач не має абонементу')
    }

    return passFound
  }

  async findActivePassByClientId(clientId?: string) {
    if (!clientId) {
      return null
    }
    const cacheKey = PassCacheKey.passByClientId(clientId)
    const cachedPass = await this.redisCacheService.get<typeof pass>(cacheKey)

    if (cachedPass) {
      return cachedPass
    }
    const pass = await this.findPassByConditions({ clientId, status: PassStatusEnum.ACTIVE }) ?? null

    if (pass) {
      this.redisCacheService.set(cacheKey, pass)
    }

    return pass
  }

  async updatePass(id: string, data: Partial<PassInsertModel>, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle
    const [updatedPass] = await dbProvider.update(pass).set(data).where(eq(pass.id, id)).returning()
    await this.redisCacheService.set(PassCacheKey.passByClientId(updatedPass.clientId), updatedPass)
    return updatedPass
  }
}
