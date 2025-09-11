import { TypedConfigService } from '@app/infrastructure/config'
import { DatabaseService, StudioPayoutRuleSelectModel, training, Transaction } from '@app/infrastructure/database'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { BadRequestException, Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { TrainingService } from '../training'
import { RedisCacheService, StaffMemberPayoutCacheKey } from '@app/infrastructure/redis'
import { StudioPayoutRuleService } from '../studio-payout-rule'
import { StaffMemberService } from '../staff-member/staff-member.service'
import { API, DATE_FORMAT, TSalaryPayoutResult } from '@app/libs'
import { staffMemberPayout } from '@app/infrastructure/database/schemas/staff-member-payout.schema'
import { inArray } from 'drizzle-orm'

@Injectable()
export class StaffMemberPayoutService {
  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
    private readonly configService: TypedConfigService,
    private readonly trainingService: TrainingService,
    private readonly redisCacheService: RedisCacheService,
    private readonly studioPayoutRuleService: StudioPayoutRuleService,
    private readonly staffMemberService: StaffMemberService,
  ) {}

  async calculateStaffPayoutSalary(staffUserId: string, payoutDate?: string) {
    const staffMember = await this.staffMemberService.findStaffMemberByCondition({ userProfileId: staffUserId })

    const startPeriodDate = (await this.getStaffMemberLastPayoutDate(staffMember.id)) || API.LOWES_DATE
    const endPeriodDate = this.dateTimeProvider.formatDateStringInTz(
      payoutDate ? this.dateTimeProvider.parseAndFormatDate({ date: payoutDate }) : new Date().toISOString(),
      DATE_FORMAT.DATE_MAIN,
    )

    const cacheKey = StaffMemberPayoutCacheKey.staffPayoutSalary(staffMember.id, startPeriodDate, endPeriodDate)

    const cachedSalaryResults = await this.redisCacheService.get<TSalaryPayoutResult>(cacheKey)

    if (cachedSalaryResults) {
      return cachedSalaryResults
    }

    const [allTrainings, staffMemberRules] = await Promise.all([
      this.trainingService.getAllTrainingsForStaffMemberSalary(staffMember.id, startPeriodDate, endPeriodDate),
      this.studioPayoutRuleService.getStaffmemberApplicablePayoutRules(staffMember.id),
    ])

    const { fixedRule: FIXED_RULE, perSignUpRule: PER_SIGNUP_RULE } = staffMemberRules

    const groups: TSalaryPayoutResult['groups'] = {}

    const trainingIds: number[] = []

    let totalPayout = 0

    for (const training of allTrainings) {
      const signUpCount = training.trainingSignups?.length || 0
      const payout = this.calculateTrainingPayout(signUpCount, FIXED_RULE, PER_SIGNUP_RULE)
      const groupName = training.group.name

      if (!groups[groupName]) {
        groups[groupName] = {
          groupName,
          trainings: [],
          groupPayout: 0,
          trainingCount: 0,
        }
      }

      groups[groupName].trainings.push({
        date: training.date,
        trainingSignups: training.trainingSignups,
        payout,
      })

      groups[groupName].groupPayout += payout
      groups[groupName].trainingCount += 1
      totalPayout += payout

      trainingIds.push(training.id)

      this.logger.debug(`Calculated payout for training ${training.id} on ${training.date}: ${payout}`)
    }

    // Sort trainings within each group by date
    Object.values(groups).forEach((group) => {
      group.trainings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    })

    const statistics = this.calculatePayoutStatistics(groups, totalPayout)

    const salaryResults: TSalaryPayoutResult = {
      groups,
      statistics,
      trainingIds,
    }

    await this.redisCacheService.set(cacheKey, salaryResults)

    return salaryResults
  }

  async getStaffMemberLastPayoutDate(staffMemberId: string) {
    const cacheKey = StaffMemberPayoutCacheKey.lastStaffPayoutDate(staffMemberId)

    const lastPaymentCashed = await this.redisCacheService.get<string>(cacheKey)

    if (lastPaymentCashed) {
      return lastPaymentCashed
    }

    const lastPayment = await this.databaseService.drizzle.query.staffMemberPayout.findFirst({
      where: (staffMemberPayout, { eq, and }) =>
        and(
          eq(staffMemberPayout.staffMemberId, staffMemberId),
          eq(staffMemberPayout.studioId, this.configService.get('STUDIO_ID')),
        ),
      orderBy: (staffMemberPayout, { desc }) => [desc(staffMemberPayout.paidAt)],
    })

    if (lastPayment) {
      this.redisCacheService.set(cacheKey, lastPayment.paidAt)
    }

    return lastPayment?.paidAt || null
  }

  async initiateStaffPayout(
    {
      staffUserId,
      amount,
      paidAt,
      description,
      trainingIds = [],
    }: { staffUserId: string; amount: string; paidAt: string; description: string; trainingIds: number[] },
    tx?: Transaction,
  ) {
    const dbProvider = tx || this.databaseService.drizzle
    const staffMember = await this.staffMemberService.findStaffMemberByCondition({ userProfileId: staffUserId })

    return await dbProvider.transaction(async (transaction) => {
      const lastPayoutDate = await this.getStaffMemberLastPayoutDate(staffMember.id)
      const paidAtDate = this.dateTimeProvider.formatDateStringInTz(
        this.dateTimeProvider.parseAndFormatDate({ date: paidAt }),
        DATE_FORMAT.DATE_MAIN,
      )

      if (lastPayoutDate) {
        const lastPayout = new Date(lastPayoutDate)
        const paidDate = new Date(paidAtDate)
        if (paidDate <= lastPayout) {
          throw new BadRequestException(`Payment date must be after last payout date: ${lastPayout.toISOString()}`)
        }
      }

      const [payout] = await transaction
        .insert(staffMemberPayout)
        .values({
          amount,
          paidAt: paidAtDate,
          staffMemberId: staffMember.id,
          studioId: this.configService.get('STUDIO_ID'),
          description,
        })
        .returning()

      if (trainingIds.length > 0) {
        await transaction.update(training).set({ staffMemberPayoutId: payout.id }).where(inArray(training.id, trainingIds))
        this.logger.info(`Linked ${trainingIds.length} trainings to payout ${payout.id}`)
      }

      await this.redisCacheService.delete(StaffMemberPayoutCacheKey.lastStaffPayoutDate(staffMember.id))

      return payout
    })
  }

  private calculateTrainingPayout(
    signUpCount: number,
    fixedRule: StudioPayoutRuleSelectModel,
    perSignUpRule: StudioPayoutRuleSelectModel,
  ): number {
    const isWithinFixedRange = signUpCount > fixedRule.minSignups && signUpCount <= (fixedRule.maxSignups ?? Infinity)

    return isWithinFixedRange ? Number(fixedRule.amount) : signUpCount * Number(perSignUpRule.amount)
  }

  private calculatePayoutStatistics(groups: TSalaryPayoutResult['groups'], totalPayout: number): TSalaryPayoutResult['statistics'] {
    const totalTrainings = Object.values(groups).reduce((sum, group) => sum + group.trainingCount, 0)
    const totalSignups = Object.values(groups).reduce(
      (sum, group) => sum + group.trainings.reduce((trainingSum, training) => trainingSum + training.trainingSignups.length, 0),
      0,
    )
    const averagePayoutPerTraining = totalTrainings > 0 ? totalPayout / totalTrainings : 0

    return {
      totalSignups,
      totalTrainings,
      averagePayoutPerTraining,
      totalPayout,
    }
  }
}
