import { GetGroupByIdResponse } from '@app/bot/libs'
import { TypedConfigService } from '@app/infrastructure/config'
import { DatabaseService, GroupSelectModel } from '@app/infrastructure/database'
import { RedisCacheService, GroupCacheKey } from '@app/infrastructure/redis'
import { GroupStatusEnum, TrainingSignupStatusEnum } from '@app/libs'
import { Injectable, NotFoundException } from '@nestjs/common'
import { UserProfileService } from '../user-profile'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'

@Injectable()
export class GroupService {
  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly databaseService: DatabaseService,
    private readonly redisCacheService: RedisCacheService,
    private readonly configService: TypedConfigService,
    private readonly userProfileService: UserProfileService,
  ) {}

  async getAllStudioGroupsByFilterConditions(filters: Partial<GroupSelectModel> = {}) {
    const allFilters = { studioId: this.configService.get('STUDIO_ID'), ...filters }

    const cacheKey = GroupCacheKey.groupByFilterConditions(allFilters)
    const groupsCached = await this.redisCacheService.get<typeof groupsFound>(cacheKey)

    if (groupsCached) {
      return groupsCached
    }

    const groupsFound = await this.databaseService.drizzle.query.group.findMany({
      where: (group, { and, eq }) => and(...Object.entries(allFilters).map(([key, value]) => eq(group[key], value))),
      with: {
        groupStyle: true,
        groupAgeRestrictions: true,
      },
    })

    groupsFound.sort((a, b) => {
      if (a.groupStyle?.sortGroupPriority && b.groupStyle?.sortGroupPriority) {
        return a.groupStyle.sortGroupPriority - b.groupStyle.sortGroupPriority
      }
      return 0
    })

    if (groupsFound) {
      await this.redisCacheService.set(cacheKey, groupsFound)
    }

    return groupsFound
  }

  async getAllGroups(filters: Partial<GroupSelectModel> = {}) {
    return this.getAllStudioGroupsByFilterConditions(filters)
  }

  async getAllActiveGroups(filters: Partial<GroupSelectModel> = {}) {
    const activeFilters = { status: GroupStatusEnum.ACTIVE, ...filters }
    return this.getAllStudioGroupsByFilterConditions(activeFilters)
  }

  async getAllActiveTrainerGroups(userId: string) {
    const userProfile = await this.userProfileService.getUserProfileById(userId)
    if (!userProfile.staffMember) {
      return []
    }
    return this.getAllActiveGroups({ staffMemberId: userProfile.staffMember.id })
  }

  async getAllUserAgeResctictedActiveGroups({ userId }: { userId: string }) {
    const [groups, userProfile] = await Promise.all([this.getAllActiveGroups(), this.userProfileService.getUserProfileById(userId)])

    const ageAppropriateGroups = groups.filter((group) => {
      if (!group.groupAgeRestrictions) {
        return true
      }

      if (!userProfile || !userProfile.dateOfBirth) {
        return false
      }

      const userAge = this.dateTimeProvider.getAgeFromBirthday(userProfile.dateOfBirth)
      const { allowedThreshold, maxAge, minAge } = group.groupAgeRestrictions

      const adjustedMinAge = minAge !== null ? minAge - (allowedThreshold ?? 0) : null
      const adjustedMaxAge = maxAge !== null ? maxAge + (allowedThreshold ?? 0) : null
      return (adjustedMinAge === null || userAge >= adjustedMinAge) && (adjustedMaxAge === null || userAge <= adjustedMaxAge)
    })

    return ageAppropriateGroups
  }

  async getGroupById(groupId: string): Promise<GetGroupByIdResponse> {
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

  async getAllTrainingsForStaffMemberSalary(staffMemberId: string, startDate?: string) {
    return this.databaseService.drizzle.query.group.findMany({
      where: (group, { eq, and }) => and(eq(group.studioId, this.configService.get('STUDIO_ID'))),
      with: {
        trainings: {
          where: (training, { and, gte, eq }) =>
            and(
              eq(training.isCancelled, false), // Not cancelled
              gte(training.date, startDate ?? '1970-01-01'), // After last payout
            ),
          with: {
            trainingSignups: {
              where: (signup, { eq }) => eq(signup.status, TrainingSignupStatusEnum.ACTIVE), // Only active signups
            },
          },
        },
      },
    })
  }
}
