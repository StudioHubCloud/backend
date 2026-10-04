import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { addDays } from 'date-fns'
import { PinoLogger } from 'nestjs-pino'
import { TypedConfigService } from '@app/infrastructure/config'
import {
  DatabaseService,
  pass,
  personalTrainingSignup,
  PersonalTrainingSignupSelectModel,
  Transaction,
} from '@app/infrastructure/database'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { RedisCacheService } from '@app/infrastructure/redis'
import {
  AuditLogEntity,
  AuditLogOperation,
  AuditLogServiceOperation,
  DATE_FORMAT,
  PassTemplateTypeEnum,
  PersonalTrainingSignupStatusEnum,
  StudioPriceTypeEnum,
} from '@app/libs'
import { PassService } from '../pass'
import { TrainingService } from '../training'

@Injectable()
export class PersonalTrainingSignupService {
  private studioId: string

  constructor(
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
    private readonly configService: TypedConfigService,
    private readonly redisCacheService: RedisCacheService,
    private readonly passService: PassService,
    private readonly trainingService: TrainingService,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    this.studioId = this.configService.getStudioId()
    this.logger.setContext(PersonalTrainingSignupService.name)
  }

  /**
   * Registers an individual training agreed offline between the client and the trainer.
   * The date may be in the past or the future — the admin records what was agreed, and the
   * pass slot is consumed immediately so the client's remaining count is always accurate.
   */
  async registerTraining(data: {
    clientId: string
    staffMemberId: string
    scheduledAt: string
  }): Promise<[PersonalTrainingSignupSelectModel, AuditLogServiceOperation[]]> {
    const { clientId, staffMemberId, scheduledAt } = data

    const activePass = await this.passService.findActivePassByClientId(clientId)

    if (!activePass) {
      throw new BadRequestException('У клієнта немає активного абонементу')
    }

    if (activePass.passTemplate.type !== PassTemplateTypeEnum.INDIVIDUAL) {
      throw new BadRequestException('Абонемент клієнта не є індивідуальним')
    }

    if (activePass.availableSlots <= 0) {
      throw new BadRequestException('У клієнта не залишилось доступних тренувань за абонементом')
    }

    const [created, logOperations] = await this.databaseService.drizzle.transaction(async (tx) => {
      const [createdRow] = await tx
        .insert(personalTrainingSignup)
        .values({
          clientId,
          staffMemberId,
          scheduledAt,
          passId: activePass.id,
          studioId: this.studioId,
          // Snapshot of one session's price (e.g. 3400 / 4 = 850) so a later price change doesn't affect payouts.
          price: Math.round(activePass.passTemplate.price / activePass.passTemplate.length),
        })
        .returning()

      const ops: AuditLogServiceOperation[] = [
        {
          entity: AuditLogEntity.PERSONAL_TRAINING_SIGNUP,
          entityId: createdRow.id,
          operation: AuditLogOperation.CREATE,
          payload: data,
          timestamp: new Date().toISOString(),
        },
      ]

      const [decrementedPass] = await tx
        .update(pass)
        .set({ availableSlots: sql`${pass.availableSlots} - 1` })
        .where(and(eq(pass.id, activePass.id), gt(pass.availableSlots, 0)))
        .returning()

      if (!decrementedPass) {
        // Someone consumed the last slot between the check above and this update.
        throw new BadRequestException('У клієнта не залишилось доступних тренувань за абонементом')
      }

      ops.push({
        entity: AuditLogEntity.PASS,
        entityId: decrementedPass.id,
        operation: AuditLogOperation.UPDATE,
        payload: { availableSlots: decrementedPass.availableSlots },
        timestamp: new Date().toISOString(),
      })

      // An individual pass starts on the date of its first registered session (no 7-day auto-activation).
      // The null check is in the WHERE, so a concurrent registration cannot overwrite the start date.
      const startDate = this.dateTimeProvider.formatDateStringInTz(scheduledAt, DATE_FORMAT.DATE_MAIN)
      const endDate = this.dateTimeProvider.formatDateStringInTz(
        addDays(startDate, activePass.passTemplate.durationDays).toISOString(),
        DATE_FORMAT.DATE_MAIN,
      )
      const [startedPass] = await tx
        .update(pass)
        .set({ startDate, endDate })
        .where(and(eq(pass.id, activePass.id), or(isNull(pass.startDate), isNull(pass.endDate))))
        .returning()

      if (startedPass) {
        ops.push({
          entity: AuditLogEntity.PASS,
          entityId: startedPass.id,
          operation: AuditLogOperation.UPDATE,
          payload: { startDate, endDate },
          timestamp: new Date().toISOString(),
        })
      }

      return [createdRow, ops] as const
    })

    await this.redisCacheService.reset()

    const allLogOperations = logOperations.map((op) => ({
      ...op,
      metadata: { serviceName: PersonalTrainingSignupService.name, methodName: this.registerTraining.name },
    }))

    return [created, allLogOperations]
  }

  /** One-off session prices of the studio (individual, duo, trio), cheapest first. */
  async getOneOffPrices() {
    // Not a module-level constant: @app/libs may still be initializing when this file loads (circular import)
    const oneOffPriceTypes = [StudioPriceTypeEnum.ONE_TIME_INDIVIDUAL, StudioPriceTypeEnum.DUO, StudioPriceTypeEnum.TRIO]
    return this.databaseService.drizzle.query.studioPrice.findMany({
      where: (price, { eq, and, inArray }) => and(eq(price.studioId, this.studioId), inArray(price.type, oneOffPriceTypes)),
      orderBy: (price, { asc }) => asc(price.price),
    })
  }

  /**
   * Registers a one-off session (individual / duo / trio) that is not tied to a client: it belongs to the trainer,
   * and `participantsNote` says who came. The price is taken from `studio_price` here, never from the caller.
   */
  async registerOneOffTraining(data: {
    staffMemberId: string
    studioPriceId: string
    scheduledAt: string
    participantsNote: string
  }): Promise<[PersonalTrainingSignupSelectModel, AuditLogServiceOperation[]]> {
    const { staffMemberId, studioPriceId, scheduledAt, participantsNote } = data

    const oneOffPrice = (await this.getOneOffPrices()).find((price) => price.id === studioPriceId)

    if (!oneOffPrice) {
      throw new BadRequestException('Обраний тип разового заняття недоступний')
    }

    // A trainer can't run two sessions at once; also stops a double-tapped "Підтвердити"
    const conflicting = await this.databaseService.drizzle.query.personalTrainingSignup.findFirst({
      where: (row, { eq, and }) =>
        and(
          eq(row.studioId, this.studioId),
          eq(row.staffMemberId, staffMemberId),
          eq(row.scheduledAt, scheduledAt),
          eq(row.status, PersonalTrainingSignupStatusEnum.SCHEDULED),
        ),
    })

    if (conflicting) {
      throw new BadRequestException('У тренера вже є індивідуальне заняття на цей час')
    }

    const [created] = await this.databaseService.drizzle
      .insert(personalTrainingSignup)
      .values({
        staffMemberId,
        scheduledAt,
        studioPriceId: oneOffPrice.id,
        price: oneOffPrice.price,
        participantsNote,
        studioId: this.studioId,
      })
      .returning()

    await this.redisCacheService.reset()

    const logOperations: AuditLogServiceOperation[] = [
      {
        entity: AuditLogEntity.PERSONAL_TRAINING_SIGNUP,
        entityId: created.id,
        operation: AuditLogOperation.CREATE,
        payload: data,
        timestamp: new Date().toISOString(),
        metadata: { serviceName: PersonalTrainingSignupService.name, methodName: this.registerOneOffTraining.name },
      },
    ]

    return [created, logOperations]
  }

  /**
   * Cancels a scheduled training and returns the slot to the pass.
   * A replayed cancel cannot inflate the balance: `transitionStatus` only matches a row still in
   * SCHEDULED, so the `+ 1` below runs at most once per registration's `- 1`.
   */
  async cancelTraining(id: string): Promise<[PersonalTrainingSignupSelectModel, AuditLogServiceOperation[]]> {
    const [updated, logOperations] = await this.databaseService.drizzle.transaction(async (tx) => {
      const updatedRow = await this.transitionStatus(
        id,
        PersonalTrainingSignupStatusEnum.SCHEDULED,
        PersonalTrainingSignupStatusEnum.CANCELED,
        { cancelledAt: new Date().toISOString() },
        tx,
      )

      const ops: AuditLogServiceOperation[] = [
        {
          entity: AuditLogEntity.PERSONAL_TRAINING_SIGNUP,
          entityId: updatedRow.id,
          operation: AuditLogOperation.UPDATE,
          payload: { status: PersonalTrainingSignupStatusEnum.CANCELED },
          timestamp: new Date().toISOString(),
        },
      ]

      if (updatedRow.passId) {
        const [restoredPass] = await tx
          .update(pass)
          .set({ availableSlots: sql`${pass.availableSlots} + 1` })
          .where(eq(pass.id, updatedRow.passId))
          .returning()

        if (restoredPass) {
          ops.push({
            entity: AuditLogEntity.PASS,
            entityId: restoredPass.id,
            operation: AuditLogOperation.UPDATE,
            payload: { availableSlots: restoredPass.availableSlots },
            timestamp: new Date().toISOString(),
          })
        }
      } else if (!updatedRow.studioPriceId) {
        // One-off sessions have no pass by design; a pass session without one lost it (pass deleted)
        this.logger.warn('Personal training signup %s has no linked pass; skipping slot restore', id)
      }

      return [updatedRow, ops] as const
    })

    await this.redisCacheService.reset()

    const allLogOperations = logOperations.map((op) => ({
      ...op,
      metadata: { serviceName: PersonalTrainingSignupService.name, methodName: this.cancelTraining.name },
    }))

    return [updated, allLogOperations]
  }

  /**
   * Confirms a session after the fact: COMPLETED pays the trainer, NO_SHOW pays 0 and the pass session stays used.
   * Only a scheduled, not paid-out session of this studio (see `transitionStatus`).
   */
  async confirmTraining(
    id: string,
    status: PersonalTrainingSignupStatusEnum.COMPLETED | PersonalTrainingSignupStatusEnum.NO_SHOW,
    confirmedById: string,
  ): Promise<[PersonalTrainingSignupSelectModel, AuditLogServiceOperation[]]> {
    const extra = { confirmedAt: new Date().toISOString(), confirmedById }
    const updated = await this.transitionStatus(id, PersonalTrainingSignupStatusEnum.SCHEDULED, status, extra)

    await this.redisCacheService.reset()

    return [updated, this.getConfirmLogOperations(updated, { status, ...extra }, this.confirmTraining.name)]
  }

  /** Takes a confirmation back (a wrong tap) while the session is not paid out: back to SCHEDULED. */
  async unconfirmTraining(id: string): Promise<[PersonalTrainingSignupSelectModel, AuditLogServiceOperation[]]> {
    const session = await this.findById(id)
    const confirmedStatuses = [PersonalTrainingSignupStatusEnum.COMPLETED, PersonalTrainingSignupStatusEnum.NO_SHOW]

    if (!session || !confirmedStatuses.includes(session.status)) {
      throw new BadRequestException(`Personal training signup ${id} is not confirmed`)
    }

    const extra = { confirmedAt: null, confirmedById: null }
    const updated = await this.transitionStatus(id, session.status, PersonalTrainingSignupStatusEnum.SCHEDULED, extra)

    await this.redisCacheService.reset()

    return [
      updated,
      this.getConfirmLogOperations(updated, { status: PersonalTrainingSignupStatusEnum.SCHEDULED, ...extra }, this.unconfirmTraining.name),
    ]
  }

  async findById(id: string) {
    return this.databaseService.drizzle.query.personalTrainingSignup.findFirst({
      where: (row, { eq, and }) => and(eq(row.id, id), eq(row.studioId, this.studioId)),
      with: {
        client: { with: { userProfile: true } },
        staffMember: { with: { userProfile: true } },
        pass: { with: { passTemplate: true } },
        studioPrice: true,
      },
    })
  }

  /**
   * Everything that occupies a trainer and starts in [fromIso, toIso]: group trainings and scheduled individual sessions.
   * Each lasts TRAINING_CONFIG.DURATION_MINUTES; `label` says what it is ("Група Jazz-Funk 16+", "DUO").
   */
  async getStaffMemberBusyIntervals(staffMemberId: string, fromIso: string, toIso: string): Promise<{ start: string; label: string }[]> {
    const [trainings, sessions] = await Promise.all([
      this.trainingService.getStaffMemberTrainingsInRange(staffMemberId, fromIso, toIso),
      this.databaseService.drizzle.query.personalTrainingSignup.findMany({
        where: (row, { eq, and, gte, lte, ne }) =>
          and(
            eq(row.studioId, this.studioId),
            eq(row.staffMemberId, staffMemberId),
            ne(row.status, PersonalTrainingSignupStatusEnum.CANCELED), // confirmed sessions still took the slot
            gte(row.scheduledAt, fromIso),
            lte(row.scheduledAt, toIso),
          ),
        with: { studioPrice: true, pass: { with: { passTemplate: true } } },
      }),
    ])

    return [
      ...trainings.map((training) => ({ start: training.date, label: `Група ${training.group.name}` })),
      ...sessions.map((session) => ({
        start: session.scheduledAt,
        label: session.studioPrice?.name ?? session.pass?.passTemplate.name ?? 'Індивідуальне',
      })),
    ]
  }

  /**
   * The studio's not cancelled sessions (all trainers, both kinds; scheduled and confirmed) starting in
   * [fromIso, toIso], soonest first.
   */
  async getStudioScheduledInRange(fromIso: string, toIso: string) {
    return this.databaseService.drizzle.query.personalTrainingSignup.findMany({
      where: (row, { eq, and, gte, lte, ne }) =>
        and(
          eq(row.studioId, this.studioId),
          ne(row.status, PersonalTrainingSignupStatusEnum.CANCELED),
          gte(row.scheduledAt, fromIso),
          lte(row.scheduledAt, toIso),
        ),
      with: {
        client: { with: { userProfile: { columns: { firstName: true, lastName: true, fullName: true } } } },
        studioPrice: true,
        pass: { with: { passTemplate: true } },
        staffMember: { with: { userProfile: true } },
      },
      orderBy: (row, { asc }) => asc(row.scheduledAt),
    })
  }

  /** Changes a one-off session's free-text note (who came, wishes…). Pass sessions have no note. */
  async updateOneOffNote(id: string, participantsNote: string) {
    const [updated] = await this.databaseService.drizzle
      .update(personalTrainingSignup)
      .set({ participantsNote })
      .where(
        and(
          eq(personalTrainingSignup.id, id),
          eq(personalTrainingSignup.studioId, this.studioId),
          isNotNull(personalTrainingSignup.studioPriceId),
          isNull(personalTrainingSignup.staffMemberPayoutId), // a paid-out session is final
        ),
      )
      .returning()

    await this.redisCacheService.reset()
    return updated ?? null
  }

  /** Scheduled sessions starting between now and `untilIso` whose reminder hasn't gone out yet (both kinds). */
  async getSessionsForReminder(untilIso: string) {
    return this.databaseService.drizzle.query.personalTrainingSignup.findMany({
      where: (row, { eq, and, gte, lte }) =>
        and(
          eq(row.studioId, this.studioId),
          eq(row.status, PersonalTrainingSignupStatusEnum.SCHEDULED),
          eq(row.reminderSent, false),
          gte(row.scheduledAt, new Date().toISOString()),
          lte(row.scheduledAt, untilIso),
        ),
      with: {
        client: { with: { userProfile: true } },
        staffMember: { with: { userProfile: true } },
        studioPrice: true,
        pass: { with: { passTemplate: true } },
      },
    })
  }

  /** Marks the reminder as sent; false when another run already did (so only one run sends it). */
  async markReminderSent(id: string): Promise<boolean> {
    const [updated] = await this.databaseService.drizzle
      .update(personalTrainingSignup)
      .set({ reminderSent: true })
      .where(
        and(
          eq(personalTrainingSignup.id, id),
          eq(personalTrainingSignup.studioId, this.studioId),
          eq(personalTrainingSignup.reminderSent, false),
        ),
      )
      .returning()
    return !!updated
  }

  /** Upcoming scheduled sessions of a trainer up to `untilIso` (one-offs and pass sessions), soonest first. */
  async getUpcomingForStaffMember(staffMemberId: string, untilIso: string) {
    return this.databaseService.drizzle.query.personalTrainingSignup.findMany({
      where: (row, { eq, and, gte, lte }) =>
        and(
          eq(row.studioId, this.studioId),
          eq(row.staffMemberId, staffMemberId),
          eq(row.status, PersonalTrainingSignupStatusEnum.SCHEDULED),
          gte(row.scheduledAt, new Date().toISOString()),
          lte(row.scheduledAt, untilIso),
        ),
      with: {
        client: { with: { userProfile: { columns: { firstName: true, lastName: true, fullName: true } } } },
        studioPrice: true,
        pass: { with: { passTemplate: true } },
      },
      orderBy: (row, { asc }) => asc(row.scheduledAt),
    })
  }

  /** Sessions of a trainer (one-offs and pass sessions) that can still be cancelled: scheduled, not paid out, past ones included. */
  async getCancellableForStaffMember(staffMemberId: string) {
    return this.databaseService.drizzle.query.personalTrainingSignup.findMany({
      where: (row, { eq, and, isNull }) =>
        and(
          eq(row.studioId, this.studioId),
          eq(row.staffMemberId, staffMemberId),
          eq(row.status, PersonalTrainingSignupStatusEnum.SCHEDULED),
          isNull(row.staffMemberPayoutId),
        ),
      with: {
        client: { with: { userProfile: { columns: { firstName: true, lastName: true, fullName: true } } } },
        studioPrice: true,
        pass: { with: { passTemplate: true } },
      },
      orderBy: (row, { asc }) => asc(row.scheduledAt),
    })
  }

  /** Full history for the client cabinet — every status, newest first. */
  async getClientSignups(clientId: string) {
    return this.databaseService.drizzle.query.personalTrainingSignup.findMany({
      where: (row, { eq, and }) => and(eq(row.clientId, clientId), eq(row.studioId, this.studioId)),
      with: {
        staffMember: { with: { userProfile: true } },
      },
      orderBy: (row, { desc }) => desc(row.scheduledAt),
    })
  }

  /** Scheduled and not yet paid out (i.e. cancellable) trainings for one client — powers the admin cancel list. */
  async getScheduledForClient(clientId: string) {
    return this.databaseService.drizzle.query.personalTrainingSignup.findMany({
      where: (row, { eq, and, isNull }) =>
        and(
          eq(row.clientId, clientId),
          eq(row.studioId, this.studioId),
          eq(row.status, PersonalTrainingSignupStatusEnum.SCHEDULED),
          isNull(row.staffMemberPayoutId),
        ),
      with: {
        staffMember: { with: { userProfile: true } },
      },
      orderBy: (row, { desc }) => desc(row.scheduledAt),
    })
  }

  /**
   * Unpaid sessions of a trainer in the payout period, up to `endDateBoundary` (UTC ISO), one-offs and pass sessions.
   * The payout closes the whole period: COMPLETED ones are paid; NO_SHOW ones and past sessions nobody confirmed are
   * closed with 0 (a session that hasn't started yet is left for a later payout).
   */
  async getUnpaidForStaffMemberSalary(staffMemberId: string, endDateBoundary: string) {
    const confirmedStatuses = [PersonalTrainingSignupStatusEnum.COMPLETED, PersonalTrainingSignupStatusEnum.NO_SHOW]
    const now = new Date().toISOString()
    const pastBoundary = endDateBoundary < now ? endDateBoundary : now

    return this.databaseService.drizzle.query.personalTrainingSignup.findMany({
      where: (row, { eq, and, or, lte, isNull, inArray }) =>
        and(
          eq(row.studioId, this.studioId),
          eq(row.staffMemberId, staffMemberId),
          isNull(row.staffMemberPayoutId),
          or(
            and(inArray(row.status, confirmedStatuses), lte(row.scheduledAt, endDateBoundary)),
            and(eq(row.status, PersonalTrainingSignupStatusEnum.SCHEDULED), lte(row.scheduledAt, pastBoundary)),
          ),
        ),
      with: {
        client: { with: { userProfile: { columns: { firstName: true, lastName: true, fullName: true } } } },
        studioPrice: true,
        pass: { with: { passTemplate: true } },
      },
      orderBy: (row, { asc }) => asc(row.scheduledAt),
    })
  }

  private getConfirmLogOperations(
    updated: PersonalTrainingSignupSelectModel,
    payload: Record<string, unknown>,
    methodName: string,
  ): AuditLogServiceOperation[] {
    return [
      {
        entity: AuditLogEntity.PERSONAL_TRAINING_SIGNUP,
        entityId: updated.id,
        operation: AuditLogOperation.UPDATE,
        payload,
        timestamp: new Date().toISOString(),
        metadata: { serviceName: PersonalTrainingSignupService.name, methodName },
      },
    ]
  }

  private async transitionStatus(
    id: string,
    from: PersonalTrainingSignupStatusEnum,
    to: PersonalTrainingSignupStatusEnum,
    extra: Partial<PersonalTrainingSignupSelectModel> = {},
    tx?: Transaction,
  ): Promise<PersonalTrainingSignupSelectModel> {
    const dbProvider = tx || this.databaseService.drizzle
    const [updated] = await dbProvider
      .update(personalTrainingSignup)
      .set({ status: to, ...extra })
      .where(
        and(
          eq(personalTrainingSignup.id, id),
          eq(personalTrainingSignup.studioId, this.studioId),
          eq(personalTrainingSignup.status, from),
          // A session already included in a trainer payout is final
          isNull(personalTrainingSignup.staffMemberPayoutId),
        ),
      )
      .returning()

    if (!updated) {
      throw new BadRequestException(`Personal training signup ${id} is not in ${from} status or is already paid out`)
    }

    return updated
  }
}
