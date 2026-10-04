import { TypedConfigService } from '@app/infrastructure/config'
import {
  DatabaseService,
  personalTrainingSignup,
  StudioPayoutRuleSelectModel,
  training,
  Transaction,
} from '@app/infrastructure/database'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { TrainingService } from '../training'
import { RedisCacheService, StaffMemberPayoutCacheKey } from '@app/infrastructure/redis'
import { StudioPayoutRuleService } from '../studio-payout-rule'
import { StaffMemberService } from '../staff-member/staff-member.service'
import { PersonalTrainingSignupService } from '../personal-training-signup'
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
    private readonly personalTrainingSignupService: PersonalTrainingSignupService,
  ) {}

  async calculateStaffPayoutSalary(staffUserId: string, payoutDate?: string) {
    const staffMember = await this.staffMemberService.findStaffMemberByCondition({ userProfileId: staffUserId })

    // The period is everything unpaid up to the end of the payout day (studio time zone). The last payout date
    // is not a lower bound, it only keys the cache so a new payout invalidates the previous result.
    const lastPayoutDate = (await this.getStaffMemberLastPayoutDate(staffMember.id)) || API.LOWES_DATE
    const endPeriodDate = payoutDate
      ? this.dateTimeProvider.parseAndFormatDate({ date: payoutDate })
      : this.dateTimeProvider.formatDateStringInTz(new Date().toISOString(), DATE_FORMAT.DATE_MAIN)
    const endDateBoundary = this.dateTimeProvider.toEndOfDateTimeStampInTz(endPeriodDate)

    const cacheKey = StaffMemberPayoutCacheKey.staffPayoutSalary(staffMember.id, lastPayoutDate, endPeriodDate)

    const cachedSalaryResults = await this.redisCacheService.get<TSalaryPayoutResult>(cacheKey)

    if (cachedSalaryResults) {
      return cachedSalaryResults
    }

    const [allTrainings, allPersonalTrainings, staffMemberRules] = await Promise.all([
      this.trainingService.getAllTrainingsForStaffMemberSalary(staffMember.id, endDateBoundary),
      this.personalTrainingSignupService.getUnpaidForStaffMemberSalary(staffMember.id, endDateBoundary),
      this.studioPayoutRuleService.getStaffmemberApplicablePayoutRules(staffMember.id),
    ])

    const { fixedRule: FIXED_RULE, perSignUpRule: PER_SIGNUP_RULE, percentageRule: PERCENTAGE_RULE } = staffMemberRules

    if (allPersonalTrainings.length > 0 && !PERCENTAGE_RULE) {
      throw new NotFoundException('No percentage payout rule found, cannot calculate individual sessions payout')
    }
    const personalPayoutPercentage = Number(PERCENTAGE_RULE?.amount ?? 0)

    const groups: TSalaryPayoutResult['groups'] = {}

    const trainingIds: number[] = []

    let groupPayout = 0

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
      groupPayout += payout

      trainingIds.push(training.id)

      this.logger.debug(`Calculated payout for training ${training.id} on ${training.date}: ${payout}`)
    }

    // Sort trainings within each group by date
    Object.values(groups).forEach((group) => {
      group.trainings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    })

    const personalTrainings: TSalaryPayoutResult['personalTrainings'] = allPersonalTrainings.map((session) => ({
      date: session.scheduledAt,
      title: session.studioPrice?.name ?? session.pass?.passTemplate.name ?? 'Індивідуальне',
      participants: session.participantsNote ?? this.getClientName(session.client?.userProfile),
      isNote: !!session.participantsNote,
      price: session.price,
      payout: Math.round((session.price * personalPayoutPercentage) / 100),
    }))
    const personalTrainingIds = allPersonalTrainings.map((session) => session.id)

    const statistics = this.calculatePayoutStatistics(groups, groupPayout, personalTrainings, personalPayoutPercentage)

    const salaryResults: TSalaryPayoutResult = {
      groups,
      personalTrainings,
      statistics,
      trainingIds,
      personalTrainingIds,
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
          eq(staffMemberPayout.studioId, this.configService.getStudioId()),
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
      personalTrainingIds = [],
    }: {
      staffUserId: string
      amount: string
      paidAt: string
      description: string
      trainingIds: number[]
      personalTrainingIds: string[]
    },
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
          studioId: this.configService.getStudioId(),
          description,
        })
        .returning()

      if (trainingIds.length > 0) {
        await transaction.update(training).set({ staffMemberPayoutId: payout.id }).where(inArray(training.id, trainingIds))
        this.logger.info(`Linked ${trainingIds.length} trainings to payout ${payout.id}`)
      }

      if (personalTrainingIds.length > 0) {
        await transaction
          .update(personalTrainingSignup)
          .set({ staffMemberPayoutId: payout.id })
          .where(inArray(personalTrainingSignup.id, personalTrainingIds))
        this.logger.info(`Linked ${personalTrainingIds.length} individual sessions to payout ${payout.id}`)
      }

      await this.redisCacheService.delete(StaffMemberPayoutCacheKey.lastStaffPayoutDate(staffMember.id))

      return payout
    })
  }

  /**
   * Group training payout: the fixed amount covers up to `fixedRule.maxSignups` people, and every person
   * above that adds `perSignUpRule.amount` (e.g. 300 for 1–3 people, 4 → 370, 8 → 650).
   */
  private calculateTrainingPayout(
    signUpCount: number,
    fixedRule: StudioPayoutRuleSelectModel,
    perSignUpRule: StudioPayoutRuleSelectModel,
  ): number {
    if (signUpCount <= fixedRule.minSignups) {
      return 0
    }

    const extraSignups = Math.max(0, signUpCount - (fixedRule.maxSignups ?? Infinity))

    return Math.round(Number(fixedRule.amount) + extraSignups * Number(perSignUpRule.amount))
  }

  private calculatePayoutStatistics(
    groups: TSalaryPayoutResult['groups'],
    groupPayout: number,
    personalTrainings: TSalaryPayoutResult['personalTrainings'],
    personalPayoutPercentage: number,
  ): TSalaryPayoutResult['statistics'] {
    const totalTrainings = Object.values(groups).reduce((sum, group) => sum + group.trainingCount, 0)
    const totalSignups = Object.values(groups).reduce(
      (sum, group) => sum + group.trainings.reduce((trainingSum, training) => trainingSum + training.trainingSignups.length, 0),
      0,
    )
    const averagePayoutPerTraining = totalTrainings > 0 ? Math.round(groupPayout / totalTrainings) : 0
    const personalPayout = personalTrainings.reduce((sum, session) => sum + session.payout, 0)

    return {
      totalSignups,
      totalTrainings,
      groupPayout,
      averagePayoutPerTraining,
      personalTrainingCount: personalTrainings.length,
      personalPayoutPercentage,
      personalPayout,
      totalPayout: groupPayout + personalPayout,
    }
  }

  private getClientName(userProfile?: { firstName: string | null; lastName: string | null; fullName: string | null } | null) {
    if (!userProfile) {
      return '—'
    }
    return userProfile.fullName || [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ') || '—'
  }
}
