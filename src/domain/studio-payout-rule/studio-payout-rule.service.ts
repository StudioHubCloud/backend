import { TypedConfigService } from '@app/infrastructure/config'
import { DatabaseService, StudioPayoutRuleSelectModel } from '@app/infrastructure/database'
import { RedisCacheService, StudioPayoutRuleCacheKey } from '@app/infrastructure/redis'
import { StudioPayoutRuleTypeEnum } from '@app/libs'
import { Injectable, NotFoundException } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'

@Injectable()
export class StudioPayoutRuleService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
    private readonly configService: TypedConfigService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async getStudioPayoutRules() {
    const studioId = this.configService.get('STUDIO_ID')
    const cacheKey = StudioPayoutRuleCacheKey.allRulesByStudioId(studioId)

    const rulesCached = await this.redisCacheService.get<StudioPayoutRuleSelectModel[]>(cacheKey)

    if (rulesCached) {
      return rulesCached
    }

    const rulesFound = await this.databaseService.drizzle.query.studioPayoutRule.findMany({
      where: (studioPayoutRule, { eq, and }) => and(eq(studioPayoutRule.studioId, studioId), eq(studioPayoutRule.isActive, true)),
    })

    if (rulesFound) {
      this.redisCacheService.set(cacheKey, rulesFound)
    }

    return rulesFound
  }

  async getStaffmemberApplicablePayoutRules(staffMemberId: string) {
    const allRules = await this.getStudioPayoutRules()
    return this.getApplicableRules(allRules || [], staffMemberId)
  }

  private getApplicableRules(studioPayoutRules: StudioPayoutRuleSelectModel[], staffMemberId: string) {
    if (!studioPayoutRules?.length) {
      this.logger.warn('No studio payout rules found')
      throw new NotFoundException('No studio payout rules found, cannot calculate staff payout salary')
    }

    // Use staff-specific rules if available, otherwise use general rules
    const trainerSpecificRules = studioPayoutRules.filter((rule) => rule.staffMemberId === staffMemberId)
    const applicableRules = trainerSpecificRules.length > 0 ? trainerSpecificRules : studioPayoutRules

    const fixedRule = applicableRules.find((rule) => rule.type === StudioPayoutRuleTypeEnum.FIXED)
    const perSignUpRule = applicableRules.find((rule) => rule.type === StudioPayoutRuleTypeEnum.PER_SIGNUP)

    if (!fixedRule || !perSignUpRule) {
      this.logger.warn('Missing required payout rules for staff member')
      throw new NotFoundException('No applicable payout rules found for staff member, cannot calculate staff payout salary')
    }

    return { fixedRule, perSignUpRule }
  }
}
