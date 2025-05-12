import { DatabaseService, PassSelectModel } from '@app/infrastructure/database'
import { RedisCacheService } from '@app/infrastructure/redis'
import { Injectable } from '@nestjs/common'

@Injectable()
export class PassService {
  private cache_key = 'pass'

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisCasheService: RedisCacheService,
  ) {}

  async findPassByConditions(conditions: Partial<PassSelectModel>) {
    const cacheKey = `${this.cache_key}:${JSON.stringify(conditions)}`

    const passCashed = await this.redisCasheService.get<PassSelectModel>(cacheKey)
    if (passCashed) {
      return passCashed
    }

    const passFound = await this.databaseService.drizzle.query.pass.findFirst({
      where: (pass, { and, eq }) => and(...Object.entries(conditions).map(([key, value]) => eq(pass[key], value))),
    })
    if (passFound) {
      await this.redisCasheService.set(cacheKey, passFound)
    }
    return passFound
  }

  async findPassByClientId(clientId: string) {
    return this.findPassByConditions({ clientId })
  }
}
