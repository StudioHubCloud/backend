import { BadRequestException, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { TypedConfigService } from '@app/infrastructure/config'
import { DatabaseService, pass, PassInsertModel, PassSelectModel, Transaction } from '@app/infrastructure/database'
import { PassCacheKey, RedisCacheService } from '@app/infrastructure/redis'
import { PassStatusEnum } from '@app/libs'

@Injectable()
export class PassService {
  private studioId: string
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisCacheService: RedisCacheService,
    private readonly configService: TypedConfigService,
  ) {
    this.studioId = this.configService.get('STUDIO_ID')
  }

  async createNewPass(data: PassInsertModel, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle
    const [createdPass] = await dbProvider.insert(pass).values(data).returning()
    return createdPass
  }

  async findPassByConditions(conditions: Partial<PassSelectModel>) {
    const passFound = await this.databaseService.drizzle.query.pass.findFirst({
      where: (pass, { and, eq }) => and(...Object.entries(conditions).map(([key, value]) => eq(pass[key], value))),
      with: {
        passTemplate: true,
      },
    })

    if (!passFound) {
      throw new BadRequestException('Користувач не має абонементу')
    }

    return passFound
  }

  async findActivePassByClientId(clientId?: string) {
    if (!clientId) {
      return null
    }
    const cacheKey = PassCacheKey.passByClientId(clientId, this.studioId)
    const cachedPass = await this.redisCacheService.get<typeof pass>(cacheKey)

    if (cachedPass) {
      return cachedPass
    }
    const pass = (await this.findPassByConditions({ clientId, status: PassStatusEnum.ACTIVE, studioId: this.studioId })) ?? null

    if (pass) {
      this.redisCacheService.set(cacheKey, pass)
    }

    return pass
  }

  async updatePass(id: string, data: Partial<PassInsertModel>, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle
    const [updateResult] = await dbProvider.update(pass).set(data).where(eq(pass.id, id)).returning()
    const updatedPass = await this.findPassByConditions({ id: updateResult.id })
    await this.redisCacheService.set(PassCacheKey.passByClientId(updatedPass.clientId, this.studioId), updatedPass)
    return updatedPass
  }
}
