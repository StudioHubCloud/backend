import { TypedConfigService } from '@app/infrastructure/config'
import { DatabaseService, GroupSelectModel } from '@app/infrastructure/database'
import { RedisCacheService, GroupCacheKey } from '@app/infrastructure/redis'
import { GroupStatusEnum } from '@app/libs'
import { Injectable, NotFoundException } from '@nestjs/common'

@Injectable()
export class GroupService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisCacheService: RedisCacheService,
    private readonly configService: TypedConfigService,
  ) {}

  async getAllGroups(filters: Partial<GroupSelectModel> = {}) {
    const cacheKey = GroupCacheKey.groupByFilterConditions(filters)
    const groupsCashed = await this.redisCacheService.get<typeof groupsFound>(cacheKey)

    if (groupsCashed) {
      return groupsCashed
    }

    const groupsFound = await this.databaseService.drizzle.query.group.findMany({
      where: (group, { and, eq }) => and(...Object.entries(filters).map(([key, value]) => eq(group[key], value))),
      with: {
        groupStyle: true,
      },
    })

    if (groupsFound) {
      this.redisCacheService.set(cacheKey, groupsFound)
    }
    return groupsFound
  }

  async getAllActiveGroups() {
    return this.getAllGroups({ status: GroupStatusEnum.ACTIVE, studioId: this.configService.get('STUDIO_ID') })
  }

  async getGroupById(groupId: string) {

    const cacheKey = GroupCacheKey.groupById(groupId)

    const groupCashed = await this.redisCacheService.get<typeof groupFound>(cacheKey)

    if (groupCashed) {
      return groupCashed
    }

    const groupFound = await this.databaseService.drizzle.query.group.findFirst({
      where: (group, { eq }) => eq(group.id, groupId),
      with: {
        groupStyle: true,
        groupAgeRestrictions: true,
        groupAgeRestrictionExeptions: true,
      },
    })

    if (!groupFound) {
      throw new NotFoundException(`Training with id: ${groupId} not found`)
    }

    if (groupFound) {
      this.redisCacheService.set(cacheKey, groupFound)
    }

    return groupFound
  }
}
