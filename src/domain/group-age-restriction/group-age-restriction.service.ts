import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { UserProfileService } from '../user-profile'
import { GroupService } from '../group/group.service'
import { differenceInYears } from 'date-fns'
import { GroupAgeRestrictionCacheKey, RedisCacheService } from '@app/infrastructure/redis'

@Injectable()
export class GroupAgeRestrictionService {

  constructor(
    private readonly redisCacheService: RedisCacheService,
    private readonly userProfileService: UserProfileService,
    private readonly groupService: GroupService,
    private readonly logger: PinoLogger,
  ) {}

  async checkIfUserPassedAgeRestriction({ userProfileId, groupId }: { userProfileId: string; groupId: number }): Promise<boolean> {
    const cacheKey = GroupAgeRestrictionCacheKey.passedAgeRestriction(userProfileId, groupId)

    if (!userProfileId || !groupId) {
      this.logger.warn('Age check failed! User profile ID %s or group ID %s is not provided.', userProfileId, groupId)
      return false
    }

    const cachedResult = await this.redisCacheService.get<boolean>(cacheKey)
    if (cachedResult !== undefined && cachedResult !== null) {
      return cachedResult
    }

    const validateAgeRestriction = async () => {
      const [userProfile, group] = await Promise.all([
        this.userProfileService.getUserProfileById(userProfileId),
        this.groupService.getGroupById(groupId),
      ])

      if (!group.groupAgeRestrictions) {
        this.logger.info('Group %s does not have age restrictions', groupId)
        return true
      }

      if (!userProfile.dateOfBirth) {
        this.logger.warn('Age check failed! User profile %s does not have dateOfBirth', userProfileId)
        return false
      }

      if (group.groupAgeRestrictionExeptions) {
        const exception = group.groupAgeRestrictionExeptions.find((exception) => exception.userProfileId === userProfileId)
        if (exception) {
          this.logger.warn('User %s is in the exception list for group %s', userProfileId, groupId)
          return true
        }
      }
      
      const { allowedThreshold, maxAge, minAge } = group.groupAgeRestrictions
      const threshhold = allowedThreshold ?? 0

      const adjMinAge = minAge !== null ? minAge - threshhold : null
      const adjMaxAge = maxAge !== null ? maxAge + threshhold : null

      const birthDate = new Date(userProfile.dateOfBirth)
      const now = new Date()
      const age = differenceInYears(now, birthDate)

      if (adjMaxAge !== null && adjMinAge !== null) {
        if (age < adjMinAge || age > adjMaxAge) {
          this.logger.warn('Age check failed! User %s is not in the allowed age range (%s - %s)', userProfileId, minAge, maxAge)
          return false
        }
      } else if (adjMinAge !== null) {
        if (age < adjMinAge) {
          this.logger.warn('Age check failed! User %s is younger than the minimum age %s', userProfileId, minAge)
          return false
        }
      } else if (adjMaxAge !== null) {
        if (age > adjMaxAge) {
          this.logger.warn('Age check failed! User %s is older than the maximum age %s', userProfileId, maxAge)
          return false
        }
      }
      return true
    }

    const canSchedule = await validateAgeRestriction()
    await this.redisCacheService.set(cacheKey, canSchedule)
    return canSchedule
  }
}
