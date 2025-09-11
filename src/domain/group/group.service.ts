import { GetGroupByIdResponse } from '@app/bot/libs'
import { TypedConfigService } from '@app/infrastructure/config'
import { DatabaseService, group, GroupInsertModel, GroupSelectModel, Transaction } from '@app/infrastructure/database'
import { RedisCacheService, GroupCacheKey } from '@app/infrastructure/redis'
import { API, GroupStatusEnum, TrainingSignupStatusEnum } from '@app/libs'
import { Injectable, NotFoundException } from '@nestjs/common'
import { UserProfileService } from '../user-profile'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { StaffMemberService } from '../staff-member'
import { eq } from 'drizzle-orm'

@Injectable()
export class GroupService {
  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly databaseService: DatabaseService,
    private readonly redisCacheService: RedisCacheService,
    private readonly configService: TypedConfigService,
    private readonly userProfileService: UserProfileService,
    private readonly staffMemberService: StaffMemberService,
  ) {}

  async getAllStudioGroupsByFilterConditions(filters: Partial<GroupSelectModel> = {}) {
    const allFilters = { studioId: this.configService.get('STUDIO_ID'), ...filters }

    const cacheKey = GroupCacheKey.groupByFilterConditions(allFilters)
    const groupsCached = await this.redisCacheService.get<typeof groupsFound>(cacheKey)

    if (groupsCached) {
      return groupsCached
    }

    const groupsFound = await this.databaseService.drizzle.query.group.findMany({
      where: (group, { and, eq, isNull }) =>
        and(
          ...Object.entries(allFilters).map(([key, value]) => {
            if (value === null) {
              return isNull(group[key])
            }
            return eq(group[key], value)
          }),
        ),
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

  async getGroupById(groupId: number): Promise<GetGroupByIdResponse> {
    const cacheKey = GroupCacheKey.groupById(groupId)

    const groupCashed = await this.redisCacheService.get<typeof groupFound>(cacheKey)

    if (groupCashed) {
      return groupCashed
    }

    const groupFound = await this.databaseService.drizzle.query.group.findFirst({
      where: (group, { eq }) => eq(group.id, groupId),
      with: {
        trainer: {
          with: { userProfile: true },
        },
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

  async getAvailableGroupsToAssignToStaff() {
    return this.getAllActiveGroups({ staffMemberId: null })
  }

  async getAvailableGroupsToDeAssignFromStaff(staffMemberId: string) {
    const staffMember = await this.staffMemberService.findStaffMemberByCondition({ userProfileId: staffMemberId })
    if (!staffMember) {
      return []
    }
    return this.getAllActiveGroups({ staffMemberId: staffMember.id })
  }

  async manageGroupStaffMember(
    groupId: number,
    staffMemberId: string,
    action: (typeof API.GROUP_ACTION)[keyof typeof API.GROUP_ACTION],
  ) {
    const staffMember = await this.staffMemberService.findStaffMemberByCondition({ userProfileId: staffMemberId })

    if (!staffMember) {
      throw new NotFoundException(`Staff member with user id: ${staffMemberId} not found`)
    }

    if (action === API.GROUP_ACTION.ASSIGN) {
      return this.updateGroupById(groupId, { staffMemberId: staffMember.id })
    } else if (action === API.GROUP_ACTION.DEASSIGN) {
      return this.updateGroupById(groupId, { staffMemberId: null })
    }

    return null
  }

  async updateGroupById(groupId: number, updateData: Partial<GroupInsertModel>, tx?: Transaction) {
    const dbProvider = tx ?? this.databaseService.drizzle

    const existingGroup = await this.getGroupById(groupId)

    if (!existingGroup) {
      throw new NotFoundException(`Group with id: ${groupId} not found`)
    }

    const [updatedGroup] = await dbProvider
      .update(group)
      .set({
        ...updateData,
      })
      .where(eq(group.id, groupId))
      .returning()

    await this.redisCacheService.reset()

    return updatedGroup
  }
}
