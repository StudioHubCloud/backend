import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, gt, sql } from 'drizzle-orm'
import { endOfDay } from 'date-fns'
import { PinoLogger } from 'nestjs-pino'
import { TypedConfigService } from '@app/infrastructure/config'
import {
  DatabaseService,
  pass,
  personalTrainingSignup,
  PersonalTrainingSignupSelectModel,
  Transaction,
} from '@app/infrastructure/database'
import { RedisCacheService } from '@app/infrastructure/redis'
import {
  AuditLogEntity,
  AuditLogOperation,
  AuditLogServiceOperation,
  PassTemplateTypeEnum,
  PersonalTrainingSignupStatusEnum,
} from '@app/libs'
import { PassService } from '../pass'

@Injectable()
export class PersonalTrainingSignupService {
  private studioId: string

  constructor(
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
    private readonly configService: TypedConfigService,
    private readonly redisCacheService: RedisCacheService,
    private readonly passService: PassService,
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

      return [createdRow, ops] as const
    })

    await this.redisCacheService.reset()

    const allLogOperations = logOperations.map((op) => ({
      ...op,
      metadata: { serviceName: PersonalTrainingSignupService.name, methodName: this.registerTraining.name },
    }))

    return [created, allLogOperations]
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
      } else {
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

  async findById(id: string) {
    return this.databaseService.drizzle.query.personalTrainingSignup.findFirst({
      where: (row, { eq }) => eq(row.id, id),
      with: {
        client: { with: { userProfile: true } },
        staffMember: { with: { userProfile: true } },
        pass: { with: { passTemplate: true } },
      },
    })
  }

  /** Full history for the client cabinet — every status, newest first. */
  async getClientSignups(clientId: string) {
    return this.databaseService.drizzle.query.personalTrainingSignup.findMany({
      where: (row, { eq }) => eq(row.clientId, clientId),
      with: {
        staffMember: { with: { userProfile: true } },
      },
      orderBy: (row, { desc }) => desc(row.scheduledAt),
    })
  }

  /** Scheduled (i.e. cancellable) trainings for one client — powers the admin cancel list. */
  async getScheduledForClient(clientId: string) {
    return this.databaseService.drizzle.query.personalTrainingSignup.findMany({
      where: (row, { eq, and }) => and(eq(row.clientId, clientId), eq(row.status, PersonalTrainingSignupStatusEnum.SCHEDULED)),
      with: {
        staffMember: { with: { userProfile: true } },
      },
      orderBy: (row, { desc }) => desc(row.scheduledAt),
    })
  }

  /**
   * Trainings a staff member has earned but not been paid for.
   * Only trainings whose datetime has already passed count — a future booking is not yet work done.
   */
  async getUnpaidForPayout(staffMemberId: string, startDate: string, endDate: string) {
    const now = new Date().toISOString()
    const endDateBoundary = endOfDay(new Date(endDate)).toISOString()

    return this.databaseService.drizzle.query.personalTrainingSignup.findMany({
      where: (row, { eq, and, isNull, gte, lte }) =>
        and(
          eq(row.staffMemberId, staffMemberId),
          eq(row.status, PersonalTrainingSignupStatusEnum.SCHEDULED),
          isNull(row.staffMemberPayoutId),
          lte(row.scheduledAt, now),
          gte(row.scheduledAt, startDate),
          lte(row.scheduledAt, endDateBoundary),
        ),
      with: { client: { with: { userProfile: true } } },
      orderBy: (row, { asc }) => asc(row.scheduledAt),
    })
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
      .where(and(eq(personalTrainingSignup.id, id), eq(personalTrainingSignup.status, from)))
      .returning()

    if (!updated) {
      throw new BadRequestException(`Personal training signup ${id} is not in ${from} status`)
    }

    return updated
  }
}
