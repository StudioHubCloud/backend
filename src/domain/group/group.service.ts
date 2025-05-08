import { DatabaseService, group, GroupSelectModel } from '@app/infrastructure/database'
import { RedisCacheService } from '@app/infrastructure/redis'
import { GroupStatusEnum } from '@app/libs'
import { Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'

@Injectable()
export class GroupService {
  private readonly cashe_key = 'groups'
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async getAllGroups(filters: Partial<GroupSelectModel> = {}) {
    const cacheKey = `${this.cashe_key}:${JSON.stringify(filters)}`
    const groupsCashed = await this.redisCacheService.get<GroupSelectModel[]>(cacheKey)

    if (groupsCashed) {
      return groupsCashed
    }

    const groupsFound = await this.databaseService.drizzle
      .select()
      .from(group)
      .where(and(...Object.entries(filters).map(([key, value]) => eq(group[key], value))))

    if (groupsFound) {
      await this.redisCacheService.set(cacheKey, groupsFound)
    }
    return groupsFound
  }

  async getAllActiveGroups () {
    return this.getAllGroups({ status: GroupStatusEnum.ACTIVE })
  }
}
