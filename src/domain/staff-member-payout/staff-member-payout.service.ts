import { TypedConfigService } from '@app/infrastructure/config'
import {
  DatabaseService,
  personalTrainingSignup,
  StaffMemberPayoutSelectModel,
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
import {
  API,
  AuditLogEntity,
  AuditLogOperation,
  AuditLogServiceOperation,
  DATE_FORMAT,
  PersonalTrainingSignupStatusEnum,
  StaffMemberPayoutStatusEnum,
  TSalaryPayoutResult,
} from '@app/libs'
import { staffMemberPayout } from '@app/infrastructure/database/schemas/staff-member-payout.schema'
import { and, eq, inArray, isNull } from 'drizzle-orm'

export const PENDING_PAYOUT_EXISTS_MESSAGE = 'Спершу оплатіть або відмініть підготовлену виплату цього тренера'

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

    const { fixedRule: FIXED_RULE, perSignUpRule: PER_SIGNUP_RULE, percentageRule: PERCENTAGE_RULE, bonusRule: BONUS_RULE } = staffMemberRules

    if (allPersonalTrainings.length > 0 && !PERCENTAGE_RULE) {
      throw new NotFoundException('No percentage payout rule found, cannot calculate individual sessions payout')
    }
    const personalPayoutPercentage = Number(PERCENTAGE_RULE?.amount ?? 0)

    const groups: TSalaryPayoutResult['groups'] = {}

    const trainingIds: number[] = []

    let groupPayout = 0
    let unmarkedTrainingCount = 0

    for (const training of allTrainings) {
      // The trainer is paid per confirmed attendee; a training nobody marked is closed with 0
      const signups = training.trainingSignups ?? []
      const confirmedSignups = signups.filter((signup) => signup.confirmedAt)
      const payout = this.calculateTrainingPayout(confirmedSignups.length, FIXED_RULE, PER_SIGNUP_RULE)
      if (!confirmedSignups.length) {
        unmarkedTrainingCount += 1
      }
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
        trainingSignups: confirmedSignups,
        signupCount: signups.length,
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

    const personalTrainings: TSalaryPayoutResult['personalTrainings'] = allPersonalTrainings.map((session) => {
      const isNoShow = session.status === PersonalTrainingSignupStatusEnum.NO_SHOW
      const isUnconfirmed = session.status === PersonalTrainingSignupStatusEnum.SCHEDULED
      return {
        date: session.scheduledAt,
        title: session.studioPrice?.name ?? session.pass?.passTemplate.name ?? 'Індивідуальне',
        participants: session.participantsNote ?? this.getClientName(session.client?.userProfile),
        isNote: !!session.participantsNote,
        isNoShow,
        isUnconfirmed,
        price: session.price,
        // No-shows and sessions nobody confirmed are closed by the payout too (final afterwards), but pay nothing
        payout: isNoShow || isUnconfirmed ? 0 : Math.round((session.price * personalPayoutPercentage) / 100),
      }
    })
    const personalTrainingIds = allPersonalTrainings.map((session) => session.id)

    const baseStatistics = this.calculatePayoutStatistics(groups, groupPayout, personalTrainings, personalPayoutPercentage)
    const { averageSignups, bonus } = this.calculateBonus(baseStatistics.totalSignups, baseStatistics.totalTrainings, BONUS_RULE)
    const statistics: TSalaryPayoutResult['statistics'] = {
      ...baseStatistics,
      personalNoShowCount: personalTrainings.filter((session) => session.isNoShow).length,
      unmarkedTrainingCount,
      pendingPersonalCount: personalTrainings.filter((session) => session.isUnconfirmed).length,
      averageSignups,
      bonusThreshold: BONUS_RULE ? BONUS_RULE.minSignups : undefined,
      bonus,
      totalPayout: baseStatistics.totalPayout + bonus,
    }

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
      status = StaffMemberPayoutStatusEnum.PAID,
      snapshot = null,
    }: {
      staffUserId: string
      amount: string
      paidAt: string
      description: string
      trainingIds: number[]
      personalTrainingIds: string[]
      status?: StaffMemberPayoutStatusEnum // PENDING: prepared by the monthly cron, an admin pays or cancels it later
      snapshot?: TSalaryPayoutResult | null
    },
    tx?: Transaction,
  ) {
    const dbProvider = tx || this.databaseService.drizzle
    const staffMember = await this.staffMemberService.findStaffMemberByCondition({ userProfileId: staffUserId })

    // One payout at a time: a prepared one must be paid or cancelled first
    const pending = await this.findPendingPayout(staffMember.id)
    if (pending) {
      throw new BadRequestException(PENDING_PAYOUT_EXISTS_MESSAGE)
    }

    const createdPayout = await dbProvider.transaction(async (transaction) => {
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
          status,
          snapshot,
        })
        .returning()

      // Only still unlinked rows: a training / session belongs to one payout
      if (trainingIds.length > 0) {
        await transaction
          .update(training)
          .set({ staffMemberPayoutId: payout.id })
          .where(and(inArray(training.id, trainingIds), isNull(training.staffMemberPayoutId)))
        this.logger.info(`Linked ${trainingIds.length} trainings to payout ${payout.id}`)
      }

      if (personalTrainingIds.length > 0) {
        await transaction
          .update(personalTrainingSignup)
          .set({ staffMemberPayoutId: payout.id })
          .where(and(inArray(personalTrainingSignup.id, personalTrainingIds), isNull(personalTrainingSignup.staffMemberPayoutId)))
        this.logger.info(`Linked ${personalTrainingIds.length} individual sessions to payout ${payout.id}`)
      }

      return payout
    })

    // Cached trainings and sessions carry `staffMemberPayoutId`, which the "no changes after payout" checks rely on
    await this.redisCacheService.reset()

    return createdPayout
  }

  /**
   * Prepares the payout of a period without paying it (monthly cron): the calculation is stored as a snapshot and its
   * trainings / sessions are linked, i.e. locked, until an admin pays or cancels it. Null when there is nothing to pay.
   */
  async preparePendingPayout(staffUserId: string, payoutDate: string, getDescription: (salary: TSalaryPayoutResult) => string) {
    const salary = await this.calculateStaffPayoutSalary(staffUserId, payoutDate)

    if (salary.statistics.totalPayout <= 0) {
      return null
    }

    return this.initiateStaffPayout({
      staffUserId,
      amount: String(salary.statistics.totalPayout),
      paidAt: payoutDate,
      description: getDescription(salary),
      trainingIds: salary.trainingIds,
      personalTrainingIds: salary.personalTrainingIds,
      status: StaffMemberPayoutStatusEnum.PENDING,
      snapshot: salary,
    })
  }

  /** paid_at ("yyyy-MM-dd HH:mm:ss") of the staff member's latest payout, or null; a new one must be dated after it. */
  async getLastPayoutDateByUserProfileId(staffUserId: string): Promise<string | null> {
    const staffMember = await this.staffMemberService.findStaffMemberByCondition({ userProfileId: staffUserId })
    return staffMember ? this.getStaffMemberLastPayoutDate(staffMember.id) : null
  }

  /** The staff member's prepared, not yet paid payout of this studio, if any. */
  async findPendingPayout(staffMemberId: string) {
    return this.databaseService.drizzle.query.staffMemberPayout.findFirst({
      where: (payout, { eq, and }) =>
        and(
          eq(payout.staffMemberId, staffMemberId),
          eq(payout.studioId, this.configService.getStudioId()),
          eq(payout.status, StaffMemberPayoutStatusEnum.PENDING),
        ),
    })
  }

  async findPendingPayoutByUserProfileId(staffUserId: string) {
    const staffMember = await this.staffMemberService.findStaffMemberByCondition({ userProfileId: staffUserId })
    return staffMember ? this.findPendingPayout(staffMember.id) : undefined
  }

  /** A payout of this studio with the staff member's profile. */
  async findPayoutById(payoutId: string) {
    return this.databaseService.drizzle.query.staffMemberPayout.findFirst({
      where: (payout, { eq, and }) => and(eq(payout.id, payoutId), eq(payout.studioId, this.configService.getStudioId())),
      with: { staffMember: { with: { userProfile: true } } },
    })
  }

  /** All prepared payouts of the studio waiting for an admin, with the staff member's profile, oldest first. */
  async findAllPendingPayouts() {
    return this.databaseService.drizzle.query.staffMemberPayout.findMany({
      where: (payout, { eq, and }) =>
        and(eq(payout.studioId, this.configService.getStudioId()), eq(payout.status, StaffMemberPayoutStatusEnum.PENDING)),
      with: { staffMember: { with: { userProfile: true } } },
      orderBy: (payout, { asc }) => asc(payout.paidAt),
    })
  }

  /** An admin pays a prepared payout. Null when it is gone or already handled (another admin, a stale button). */
  async approvePendingPayout(payoutId: string): Promise<[StaffMemberPayoutSelectModel, AuditLogServiceOperation[]] | null> {
    const [approved] = await this.databaseService.drizzle
      .update(staffMemberPayout)
      .set({ status: StaffMemberPayoutStatusEnum.PAID })
      .where(
        and(
          eq(staffMemberPayout.id, payoutId),
          eq(staffMemberPayout.studioId, this.configService.getStudioId()),
          eq(staffMemberPayout.status, StaffMemberPayoutStatusEnum.PENDING),
        ),
      )
      .returning()

    if (!approved) {
      return null
    }
    await this.redisCacheService.reset()
    return [approved, this.getPayoutLogOperations(approved.id, { status: StaffMemberPayoutStatusEnum.PAID }, this.approvePendingPayout.name)]
  }

  /**
   * An admin cancels a prepared payout: it is deleted, which unlinks (unlocks) its trainings and sessions
   * (ON DELETE SET NULL), and the period is paid manually later. Null when it is gone or already handled.
   */
  async cancelPendingPayout(payoutId: string): Promise<[StaffMemberPayoutSelectModel, AuditLogServiceOperation[]] | null> {
    const [deleted] = await this.databaseService.drizzle
      .delete(staffMemberPayout)
      .where(
        and(
          eq(staffMemberPayout.id, payoutId),
          eq(staffMemberPayout.studioId, this.configService.getStudioId()),
          eq(staffMemberPayout.status, StaffMemberPayoutStatusEnum.PENDING),
        ),
      )
      .returning()

    if (!deleted) {
      return null
    }
    await this.redisCacheService.reset()
    return [deleted, this.getPayoutLogOperations(deleted.id, { deleted: true, amount: deleted.amount, paidAt: deleted.paidAt }, this.cancelPendingPayout.name)]
  }

  private getPayoutLogOperations(payoutId: string, payload: Record<string, unknown>, methodName: string): AuditLogServiceOperation[] {
    return [
      {
        entity: AuditLogEntity.STAFF_MEMBER_PAYOUT,
        entityId: payoutId,
        operation: AuditLogOperation.UPDATE,
        payload,
        timestamp: new Date().toISOString(),
        metadata: { serviceName: StaffMemberPayoutService.name, methodName },
      },
    ]
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

  /**
   * Group bonus: + rule amount when the period's group trainings averaged at least `minSignups` confirmed people
   * (every training of the payout counts, unmarked ones too). Per staff member and payout; no rule, no bonus.
   */
  private calculateBonus(totalSignups: number, totalTrainings: number, bonusRule?: StudioPayoutRuleSelectModel) {
    const exactAverage = totalTrainings > 0 ? totalSignups / totalTrainings : 0
    const bonus = bonusRule && totalTrainings > 0 && exactAverage >= bonusRule.minSignups ? Math.round(Number(bonusRule.amount)) : 0
    // Shown rounded down (9.96 is "9.9", not a misleading "10.0" without the bonus)
    return { averageSignups: Math.floor(exactAverage * 10) / 10, bonus }
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
      personalTrainingCount: personalTrainings.filter((session) => !session.isNoShow && !session.isUnconfirmed).length,
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
