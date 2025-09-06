import { TypedConfigService } from '@app/infrastructure/config'
import { Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService, staffMember, StaffMemberSelectModel, Transaction } from '@app/infrastructure/database'
import { RedisCacheService, StaffMemberCacheKey } from '@app/infrastructure/redis'

@Injectable()
export class StaffMemberService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async createOne(data: { userProfileId: string }, tx?: Transaction) {
    const db = tx || this.databaseService.drizzle
    const [createdTrainer] = await db.insert(staffMember).values(data).returning()
    return createdTrainer
  }

  async getOneById(staffMemberId: string) {
    const cacheKey = StaffMemberCacheKey.staffMemberById(staffMemberId)

    const staffMemberCashed = await this.redisCacheService.get<typeof staffMemberFound>(cacheKey)

    if (staffMemberCashed) {
      return staffMemberCashed
    }

    const staffMemberFound = await this.databaseService.drizzle.query.staffMember.findFirst({
      where: (staffMember, { eq }) => eq(staffMember.id, staffMemberId),
      with: {
        userProfile: true,
      },
    })

    if (!staffMemberFound) {
      throw new NotFoundException(`Staff member with id: ${staffMemberId} not found`)
    }

    if (staffMemberFound) {
      this.redisCacheService.set(cacheKey, staffMemberFound)
    }

    return staffMemberFound
  }

  async findStaffMemberByCondition(conditions: Partial<StaffMemberSelectModel>) {
    const cacheKey = StaffMemberCacheKey.staffMemberByFilterConditions(conditions)

    const staffMemberCashed = await this.redisCacheService.get<typeof staffMemberFound>(cacheKey)
    if (staffMemberCashed) {
      return staffMemberCashed
    }

    const staffMemberFound = await this.databaseService.drizzle.query.staffMember.findFirst({
      where: (staffMember, { and, eq }) => and(...Object.entries(conditions).map(([key, value]) => eq(staffMember[key], value))),
      with: {
        userProfile: true,
      },
    })

    if (!staffMemberFound) {
      throw new NotFoundException(`Staff member with conditions: ${JSON.stringify(conditions)} not found`)
    }

    this.redisCacheService.set(cacheKey, staffMemberFound)
    return staffMemberFound
  }
}
