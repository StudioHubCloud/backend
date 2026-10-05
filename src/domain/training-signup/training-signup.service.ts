import { BadRequestException, forwardRef, Inject, Injectable } from '@nestjs/common'
import { and, eq, exists, isNull, ne } from 'drizzle-orm'
import { PinoLogger } from 'nestjs-pino'
import { addDays, format, isAfter, isBefore, parseISO, subHours } from 'date-fns'
import {
  DatabaseService,
  group,
  training,
  TrainingSelectModel,
  trainingSignup,
  TrainingSignupInsertModel,
  TrainingSignupSelectModel,
  Transaction,
  UserProfileSelectModel,
} from '@app/infrastructure/database'
import {
  API,
  AuditLogEntity,
  AuditLogOperation,
  DATE_FORMAT,
  GroupStatusEnum,
  PassStatusEnum,
  PassTemplateTypeEnum,
  TrainingSignupStatusEnum,
  TrainingSignupTypeEnum,
} from '@app/libs/constants'
import { AuditLogServiceOperation, AuditLogServiceResponse, TCustomApiResponse } from '@app/libs/types'
import { PassService } from '../pass/pass.service'
import { PassSelectionHelper } from '../pass/pass-selection.helper'
import { TrainingService } from '../training/training.service'
import { GroupAgeRestrictionService } from '../group-age-restriction/group-age-restriction.service'
import { RedisCacheService, TrainingSignupCacheKey } from '@app/infrastructure/redis'
import { COMMON } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { UserProfileService } from '../user-profile'
import { TypedConfigService } from '@app/infrastructure/config'

const BUTTON_CREATE_SPECIAL_RECORD = BUTTON_PATTERNS.CREATE_CUSTOM_SCHEDULE_RECORD

type TActivePass = Awaited<ReturnType<PassService['findActivePassesByClientId']>>['passes'][number]

@Injectable()
export class TrainingSignupService {
  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    @Inject(forwardRef(() => TrainingService))
    private readonly trainingService: TrainingService,
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
    private readonly passService: PassService,
    private readonly groupAgeRestrictionService: GroupAgeRestrictionService,
    private readonly redisCacheService: RedisCacheService,
    private readonly userProfileService: UserProfileService,
    private readonly configService: TypedConfigService,
  ) {}

  async findTrainingSignupsByCondition(conditions: Partial<TrainingSignupSelectModel>) {
    return this.databaseService.drizzle.query.trainingSignup.findMany({
      where: (ts, { eq, and }) => and(...Object.entries(conditions).map(([key, value]) => eq(ts[key], value))),
    })
  }

  async getClientSignups(
    userProfileId: string,
  ): Promise<(TrainingSignupSelectModel & { training: TrainingSelectModel; group: { groupStyle: { title: string } } })[]> {
    const cache_key = TrainingSignupCacheKey.clientSignups(userProfileId)
    const cachedSignups = await this.redisCacheService.get<typeof signups>(cache_key)
    if (cachedSignups) {
      return cachedSignups
    }
    const signups = await this.databaseService.drizzle.query.trainingSignup.findMany({
      where: (ts, { eq }) => and(eq(ts.userProfileId, userProfileId), eq(ts.status, TrainingSignupStatusEnum.ACTIVE)),
      with: {
        training: true,
        group: {
          with: {
            groupStyle: true,
          },
        },
      },
    })
    if (signups) {
      this.redisCacheService.set(cache_key, signups)
    }
    return signups
  }

  async getClientGroupSignups(userProfileId: string, groupId: number) {
    //unused
    const cache_key = TrainingSignupCacheKey.clientSignupsInGroup(userProfileId, groupId)

    const cachedSignups = await this.redisCacheService.get<typeof signups>(cache_key)
    if (cachedSignups) {
      return cachedSignups
    }

    const signups = await this.databaseService.drizzle.query.trainingSignup.findMany({
      where: (ts, { eq, and }) => and(eq(ts.userProfileId, userProfileId), eq(ts.groupId, groupId)),
      with: {
        training: true,
      },
    })

    if (signups) {
      this.redisCacheService.set(cache_key, signups)
    }
    return signups
  }

  /**
   * Client signup from "Розклад". The pass is picked by the rules in PassSelectionHelper (a client may hold several
   * active passes): FIXED of this group first, then FLEX, the one that ends first. `passNote` is set when the pass
   * used is not the client's current one, so the bot can say which pass paid for it.
   */
  async signUpForTrainingAsClientViaTelegram(values: {
    trainingId: number
    userProfileId: string
    clientId: string
  }): Promise<TCustomApiResponse<AuditLogServiceResponse> & { availableSlots?: number; passNote?: string }> {
    const { clientId, trainingId, userProfileId } = values
    try {
      const logOperations: AuditLogServiceOperation[] = []

      const [training, isAlreadySignedUp, { passes, currentPassId }] = await Promise.all([
        this.trainingService.getTrainingById(trainingId),
        this.checkIfAlreadySignedUpForTraining(userProfileId, trainingId),
        this.passService.findActivePassesByClientId(clientId),
      ])

      const ageRestrictionPassed = await this.groupAgeRestrictionService.checkIfUserPassedAgeRestriction({
        userProfileId,
        groupId: training.groupId,
      })

      if (!training.group || training.group.status === GroupStatusEnum.INACTIVE) {
        this.logger.warn('Group %s is not found or inactive', training.groupId)
        return {
          status: API.RESPONSE.ERROR_STRING,
          message: `Запис неможливий — група не знайдена або неактивна🥺\nСпробуй обрати іншу групу🫶🏻`,
        }
      }

      if (training.isLocked) {
        this.logger.warn('Training %s is locked', trainingId)
        return {
          status: API.RESPONSE.ERROR_STRING,
          message: `На жаль, запис на це тренування заблокований 😔\nЗа уточненнями звертайся до тренера 🙏`,
        }
      }

      if (!ageRestrictionPassed) {
        this.logger.warn('User %s does not pass age restriction for group %s', userProfileId, training.groupId)
        return {
          status: API.RESPONSE.ERROR_STRING,
          message: `На жаль, ця група не підходить за віком 😔\nАле не хвилюйся — ми підберемо для тебе ідеальний варіант, де буде комфортно та цікаво! ✨`,
        }
      }

      if (isAlreadySignedUp) {
        this.logger.warn('User %s is already signed up for training %s', userProfileId, trainingId)
        return { status: API.RESPONSE.ERROR_STRING, message: `Ти вже записана на це тренування💝\nГотуй форму і гарний настрій!` }
      }

      if (training.isCancelled) {
        this.logger.warn('Training %s is cancelled', trainingId)
        return {
          status: API.RESPONSE.ERROR_STRING,
          message: `На жаль, тренування було скасовано 😔\nПросимо вибачення за незручності — а поки ти завжди можеш обрати інше тренування🎀`,
        }
      }

      const today = this.passService.getTodayDateString()
      const trainingDay = this.dateTimeProvider.formatDateStringInTz(training.date, DATE_FORMAT.DATE_MAIN)
      const pass = PassSelectionHelper.pickForTraining(passes, training.groupId, trainingDay, today)

      if (!pass) {
        this.logger.warn('Client %s has no pass for training %s (group %s)', clientId, trainingId, training.groupId)
        return { status: API.RESPONSE.ERROR_STRING, message: this.getNoPassForTrainingMessage(passes, training.groupId, trainingDay, today) }
      }

      if (!PassSelectionHelper.isStarted(pass)) {
        // Starts on the day of the signup action (owner, 2026-10-05)
        const endDateString = format(addDays(parseISO(today), pass.passTemplate.durationDays), DATE_FORMAT.DATE_MAIN)
        const [_, updatePassLogOperations] = await this.passService.updatePass(pass.id, { startDate: today, endDate: endDateString })
        logOperations.push(...updatePassLogOperations)
      }

      const signupPayload = {
        trainingId,
        userProfileId,
        passId: pass.id,
        groupId: training.groupId,
        type: TrainingSignupTypeEnum.MAIN,
      }
      const [_, signUpLogOperations] = await this.signUpForTraining(signupPayload)
      logOperations.push(...signUpLogOperations)

      await this.redisCacheService.reset()

      const updatedPass = await this.passService.findPassByConditions({ id: pass.id, status: PassStatusEnum.ACTIVE })

      if (!updatedPass) {
        this.logger.warn('Updated pass %s is not found after signup', pass.id)
        return {
          status: API.RESPONSE.ERROR_STRING,
          message: `Виникла помилка при записі на тренування 😔\nВідсутній активний абонемент`,
        }
      }

      return {
        status: API.RESPONSE.SUCCESS_STRING,
        availableSlots: updatedPass.availableSlots,
        passNote: this.getOtherPassNote(passes, currentPassId, pass, training.groupId, trainingDay, today),
        message: '✅ Ти успішно записана на тренування в групі!\nЧекаємо на тебе🫶🏻',
        data: {
          logOperations: logOperations.map((op) => ({
            ...op,
            metadata: { serviceName: TrainingSignupService.name, methodName: this.signUpForTrainingAsClientViaTelegram.name },
          })),
        },
      }
    } catch (error) {
      this.logger.error(`Error signing up for training %s for user %s: %j`, userProfileId, trainingId, error.stack)
      return {
        status: API.RESPONSE.ERROR_STRING,
        message: 'Виникла помилка при записі на тренування 😔',
      }
    }
  }

  /** Why none of the client's passes can pay for this training, for the client. */
  private getNoPassForTrainingMessage(passes: TActivePass[], groupId: number, trainingDay: string, today: string): string {
    const groupPasses = passes.filter((pass) => pass.passTemplate.type === PassTemplateTypeEnum.GROUP)

    if (!passes.length) {
      return `Ой-ой! 🤸‍♀️\n\nПоки що не бачу твого активного абонементу 😔`
    }

    if (!groupPasses.length) {
      return `Це індивідуальний абонемент — ним не можна записатись на групове тренування 😔\nДату індивідуального тренування узгодь зі своїм тренером 🤝`
    }

    const coveringPasses = groupPasses.filter((pass) => PassSelectionHelper.coversGroup(pass, groupId))

    if (!coveringPasses.length) {
      const groupNames = [...new Set(groupPasses.map((pass) => pass.group?.name).filter(Boolean))].map((name) => `«${name}»`)
      const where = groupNames.length > 1 ? `в групах ${groupNames.join(', ')}` : `в групі ${groupNames[0]}`
      return `Твій абонемент діє лише ${where} 😔\nЩоб відвідувати тренування в іншій групі, звернись до адміністратора 🫶🏻`
    }

    const isExpired = coveringPasses.every(
      (pass) => PassSelectionHelper.getRefusal(pass, groupId, trainingDay, today) === 'expired',
    )
    return isExpired
      ? `Упс! 🤸‍♀️ Термін дії абонемента закінчився 💥\nСаме час поновити абонемент ❤️‍🔥`
      : `Упс! 🤸‍♀️ Усі тренування за цим абонементом використано 💥\nСаме час поновити абонемент ❤️‍🔥`
  }

  /** Set when the signup used a pass other than the client's current one. */
  private getOtherPassNote(
    passes: TActivePass[],
    currentPassId: string | null,
    usedPass: TActivePass,
    groupId: number,
    trainingDay: string,
    today: string,
  ): string | undefined {
    const currentPass = PassSelectionHelper.getCurrentPass(passes, currentPassId, today)

    if (!currentPass || currentPass.id === usedPass.id) {
      return undefined
    }

    // "it ends first" is the reason only when the current pass could have paid too
    const currentCouldPay = PassSelectionHelper.getRefusal(currentPass, groupId, trainingDay, today) === null
    const reason = currentCouldPay ? ' — він закінчується раніше, тож використаємо його першим' : ''

    return `✨ Це тренування піде з абонемента ${PassSelectionHelper.getLabel(usedPass)}${reason} 🫶🏻`
  }

  //unused
  async signUpForTrainingAsGuestViaTelegram(values: { trainingId: number; userProfileId: string }): Promise<TCustomApiResponse> {
    const training = await this.trainingService.getTrainingById(values.trainingId)
    if (!training) {
      return { status: API.RESPONSE.ERROR_STRING, message: 'Тренування не знайдено' }
    }
    await this.signUpForTraining({
      ...values,
      groupId: training.groupId,
      type: TrainingSignupTypeEnum.TRIAL,
    })

    return { status: API.RESPONSE.SUCCESS_STRING, message: 'Запис успішний' }
  }

  async signOutFromTrainingAsClientViaTelegram(trainingSignupId: string): Promise<TCustomApiResponse> {
    try {
      const signup = await this.databaseService.drizzle.query.trainingSignup.findFirst({
        where: (ts, { eq }) => eq(ts.id, trainingSignupId),
        with: {
          training: true,
          userProfile: true,
          pass: true,
        },
      })

      if (!signup) {
        return {
          status: API.RESPONSE.ERROR_STRING,
          message: `На жаль, запис не знайдено 😔\nМожливо, щось пішло не так — давай спробуємо ще раз!`,
        }
      }

      const now = new Date()
      const trainingDate = new Date(signup.training.date)
      const signoutDeadline = subHours(trainingDate, COMMON.SIGNOUT_ALLOWED_HOURS_BEFORE_TRAINING)

      if (signup.status !== TrainingSignupStatusEnum.ACTIVE) {
        return { status: API.RESPONSE.ERROR_STRING, message: `Запис наразі не активний 🙈` }
      }
      if (signup.type === TrainingSignupTypeEnum.TRIAL || !signup.pass) {
        return {
          status: API.RESPONSE.ERROR_STRING,
          message: `На жаль, вже не можна відмінити запис на пробне тренування🌝\nЧекаємо на тебе🩷`,
        }
      }

      if (isBefore(trainingDate, now)) {
        return {
          status: API.RESPONSE.ERROR_STRING,
          message: `Тренування вже відбулося🌝\nВідміна неможлива🩷`,
        }
      }

      if (isAfter(now, signoutDeadline)) {
        return {
          status: API.RESPONSE.ERROR_STRING,
          message: `На жаль, вже не можна відмінити запис на тренування🌝\nЧекаємо на тебе🩷`,
        }
      }

      await this.signOutFromTraining({ id: signup.id })
      await this.redisCacheService.reset()

      return {
        status: API.RESPONSE.SUCCESS_STRING,
        message: `Запис скасовано 😌\nСподіваємося побачити тебе на наступному тренуванні! 💃✨`,
      }
    } catch (error) {
      this.logger.error(`Error signing out from training %s: %j`, trainingSignupId, error.stack)
      return {
        status: API.RESPONSE.ERROR_STRING,
        message: 'Виникла помилка при виписці з тренування 😔',
      }
    }
  }

  async signOutFromTrainingAsAdminViaTelegram(trainingSignupId: string): Promise<
    TCustomApiResponse<{
      userProfile: UserProfileSelectModel | null
      training: TrainingSelectModel | null
      fallbackUsername: string | null
    }>
  > {
    try {
      const signup = await this.databaseService.drizzle.query.trainingSignup.findFirst({
        where: (ts, { eq }) => eq(ts.id, trainingSignupId),
        with: {
          training: true,
          userProfile: true,
          pass: true,
        },
      })

      if (!signup) {
        return { status: API.RESPONSE.ERROR_STRING, message: `На жаль, запис не знайдено 😔` }
      }

      if (signup.status !== TrainingSignupStatusEnum.ACTIVE) {
        return { status: API.RESPONSE.ERROR_STRING, message: `Запис наразі не активний 🙈` }
      }

      if (signup.training.staffMemberPayoutId) {
        return { status: API.RESPONSE.ERROR_STRING, message: COMMON.PAID_OUT_MESSAGE }
      }

      await this.signOutFromTraining({ id: signup.id })
      await this.redisCacheService.reset()

      return {
        status: API.RESPONSE.SUCCESS_STRING,
        message: `✅ Клієнта успішно виписано з тренування`,
        data: { userProfile: signup.userProfile, training: signup.training, fallbackUsername: signup.fallbackUsername },
      }
    } catch (error) {
      this.logger.error(`Error signing out from training %s: %j`, trainingSignupId, error.stack)
      return {
        status: API.RESPONSE.ERROR_STRING,
        message: 'Виникла помилка при виписці з тренування 😔',
      }
    }
  }

  /**
   * Admin (and AI) signs a client in. The pass must be valid and pays one training: a pass covering the group is
   * used silently; without one the admin picks one of the client's other valid group passes (`passChoice`, then
   * again with `passId`). No valid group pass at all → refused (a walk-in goes through "Створити спеціальний запис").
   */
  async signInToTrainingAsAdminViaTelegram(
    clientUserId: string,
    trainingId: number,
    passId?: string,
  ): Promise<
    TCustomApiResponse<{ groupId: number; userProfile: UserProfileSelectModel | null; logOperations: AuditLogServiceOperation[] }> & {
      passChoice?: { id: string; name: string }[]
    }
  > {
    try {
      const [training, isAlreadySignedUp, userProfile] = await Promise.all([
        this.trainingService.getTrainingById(trainingId),
        this.checkIfAlreadySignedUpForTraining(clientUserId, trainingId),
        this.userProfileService.getUserProfileById(clientUserId),
      ])

      if (!userProfile) {
        return { status: API.RESPONSE.ERROR_STRING, message: 'Клієнта не знайдено 🥲' }
      }

      if (!training) {
        return { status: API.RESPONSE.ERROR_STRING, message: '🥺 Тренування не знайдено' }
      }

      if (training.isCancelled) {
        return { status: API.RESPONSE.ERROR_STRING, message: `На жаль, тренування було скасовано 😔` }
      }

      if (training.staffMemberPayoutId) {
        return { status: API.RESPONSE.ERROR_STRING, message: COMMON.PAID_OUT_MESSAGE }
      }

      if (isAlreadySignedUp) {
        return { status: API.RESPONSE.ERROR_STRING, message: `Клієнт вже записаний на це тренування 💝` }
      }

      const clientId = userProfile.client?.id
      const { passes, currentPassId } = clientId
        ? await this.passService.findActivePassesByClientId(clientId)
        : { passes: [], currentPassId: null }
      const today = this.passService.getTodayDateString()
      const trainingDay = this.dateTimeProvider.formatDateStringInTz(training.date, DATE_FORMAT.DATE_MAIN)
      // Valid group passes regardless of the group, the ones that end first first
      const validPasses = PassSelectionHelper.getValidIgnoringGroup(passes, trainingDay, today)

      let pass: TActivePass | null
      if (passId) {
        // Chosen in the bot or by the AI: re-checked here, never trusted from the callback
        pass = validPasses.find((p) => p.id === passId) ?? null
        if (!pass) {
          return { status: API.RESPONSE.ERROR_STRING, message: `Цей абонемент більше не підходить для запису 🥲 Спробуйте ще раз.` }
        }
      } else {
        pass = PassSelectionHelper.pickForTraining(passes, training.groupId, trainingDay, today)
      }

      if (!pass) {
        if (!validPasses.length) {
          return {
            status: API.RESPONSE.ERROR_STRING,
            message: `У клієнта немає дійсного групового абонемента з вільними тренуваннями 🥲\nЯкщо клієнт платить на місці — «${BUTTON_CREATE_SPECIAL_RECORD}».`,
          }
        }

        return {
          status: API.RESPONSE.ERROR_STRING,
          message: `⚠️ У клієнта немає абонемента для групи «${training.group?.name ?? ''}».\nЗ якого абонемента списати тренування?`,
          passChoice: validPasses.map((p) => ({ id: p.id, name: PassSelectionHelper.getLabel(p, { withSlots: true }) })),
        }
      }

      const logOperations: AuditLogServiceOperation[] = []

      if (!PassSelectionHelper.isStarted(pass)) {
        // Starts on the day of the signup action, like a client's own signup
        const endDateString = format(addDays(parseISO(today), pass.passTemplate.durationDays), DATE_FORMAT.DATE_MAIN)
        const [_, updatePassLogOperations] = await this.passService.updatePass(pass.id, { startDate: today, endDate: endDateString })
        logOperations.push(...updatePassLogOperations)
      }

      const [__, signUpLogOperations] = await this.signUpForTraining({
        trainingId,
        userProfileId: clientUserId,
        groupId: training.groupId,
        type: TrainingSignupTypeEnum.MAIN,
        passId: pass.id,
      })
      logOperations.push(...signUpLogOperations)

      await this.redisCacheService.reset()

      // Paid by a pass other than the client's current one (e.g. the current one is individual): say which
      const currentPass = PassSelectionHelper.getCurrentPass(passes, currentPassId, today)
      const passNote = currentPass && currentPass.id !== pass.id ? `\nℹ️ Списано з абонемента ${PassSelectionHelper.getLabel(pass)}` : ''

      return {
        status: API.RESPONSE.SUCCESS_STRING,
        message: `✅ Клієнта успішно записано на тренування${passNote}`,
        data: {
          groupId: training.groupId,
          userProfile,
          logOperations: logOperations.map((op) => ({
            ...op,
            metadata: { serviceName: TrainingSignupService.name, methodName: this.signInToTrainingAsAdminViaTelegram.name },
          })),
        },
      }
    } catch (error) {
      this.logger.error(`Error signing in to training %s for user %s: %j`, clientUserId, trainingId, error.stack)
      return {
        status: API.RESPONSE.ERROR_STRING,
        message: 'Виникла помилка при записі на тренування 😔',
      }
    }
  }

  async getTrainingActiveSignups(trainingId: number) {
    const cacheKey = TrainingSignupCacheKey.trainingActiveSignups(trainingId)
    const cachedSignups = await this.redisCacheService.get<typeof result>(cacheKey)
    if (cachedSignups) {
      return cachedSignups
    }

    const result = await this.databaseService.drizzle.query.trainingSignup.findMany({
      where: (ts, { eq, and, or }) =>
        and(
          eq(ts.trainingId, trainingId),
          eq(ts.status, TrainingSignupStatusEnum.ACTIVE),
          or(
            eq(ts.type, TrainingSignupTypeEnum.MAIN),
            eq(ts.type, TrainingSignupTypeEnum.TRIAL),
            eq(ts.type, TrainingSignupTypeEnum.SPECIAL),
          ),
        ),
      with: {
        userProfile: true,
        group: true,
      },
    })
    if (result) {
      this.redisCacheService.set(cacheKey, result)
    }
    return result
  }

  async getTrainingCancelledSignups(trainingId: number) {
    const cacheKey = TrainingSignupCacheKey.trainingCanceledSignups(trainingId)
    const cachedSignups = await this.redisCacheService.get<typeof result>(cacheKey)
    if (cachedSignups) {
      return cachedSignups
    }

    const result = await this.databaseService.drizzle.query.trainingSignup.findMany({
      where: (ts, { eq, and, or }) =>
        and(
          eq(ts.trainingId, trainingId),
          eq(ts.status, TrainingSignupStatusEnum.CANCELED),
          or(
            eq(ts.type, TrainingSignupTypeEnum.MAIN),
            eq(ts.type, TrainingSignupTypeEnum.TRIAL),
            eq(ts.type, TrainingSignupTypeEnum.SPECIAL),
          ),
        ),
      with: {
        userProfile: true,
        group: true,
      },
    })
    if (result) {
      this.redisCacheService.set(cacheKey, result)
    }
    return result
  }

  async cancelAllActiveTrainingSignupsForTraining(trainingId: number, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle

    return dbProvider
      .update(trainingSignup)
      .set({ status: TrainingSignupStatusEnum.CANCELED })
      .where(and(eq(trainingSignup.trainingId, trainingId), eq(trainingSignup.status, TrainingSignupStatusEnum.ACTIVE)))
      .returning()
  }

  async activateAllCancelledTrainingSignupsForTraining(trainingId: number, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle

    return dbProvider
      .update(trainingSignup)
      .set({ status: TrainingSignupStatusEnum.ACTIVE })
      .where(and(eq(trainingSignup.trainingId, trainingId), eq(trainingSignup.status, TrainingSignupStatusEnum.CANCELED)))
      .returning()
  }

  /**
   * A signup by name for someone who is not a client (e.g. a one-time visitor). `confirmedById` marks them as
   * already present, for visitors added on site at the training.
   */
  async createSpecialScheduleSignup(values: { trainingId: number; fallbackUsername: string; groupId: number; confirmedById?: string }) {
    const { trainingId, fallbackUsername, groupId, confirmedById } = values
    const targetTraining = await this.trainingService.getTrainingById(trainingId)
    this.trainingService.assertNotPaidOut(targetTraining)

    const result = await this.signUpForTraining({
      trainingId,
      userProfileId: null,
      groupId,
      type: TrainingSignupTypeEnum.SPECIAL,
      fallbackUsername,
      ...(confirmedById && { confirmedAt: new Date().toISOString(), confirmedById }),
    })
    await this.redisCacheService.reset()
    return result
  }

  /**
   * Confirms (or takes back) that the client of an active signup came to the training: the trainer is paid per
   * confirmed attendee. Refused for another studio's, a cancelled or an already paid-out training, all checked in
   * the UPDATE itself so a stale button can't slip through.
   */
  async setAttendance(
    signupId: string,
    attended: boolean,
    confirmedById: string,
  ): Promise<[TrainingSignupSelectModel, AuditLogServiceOperation[]]> {
    const values = attended
      ? { confirmedAt: new Date().toISOString(), confirmedById }
      : { confirmedAt: null, confirmedById: null }

    const [updated] = await this.databaseService.drizzle
      .update(trainingSignup)
      .set(values)
      .where(
        and(
          eq(trainingSignup.id, signupId),
          eq(trainingSignup.status, TrainingSignupStatusEnum.ACTIVE),
          exists(
            this.databaseService.drizzle
              .select()
              .from(training)
              .innerJoin(group, eq(group.id, training.groupId))
              .where(
                and(
                  eq(training.id, trainingSignup.trainingId),
                  eq(training.isCancelled, false),
                  isNull(training.staffMemberPayoutId),
                  eq(group.studioId, this.configService.getStudioId()),
                ),
              ),
          ),
        ),
      )
      .returning()

    if (!updated) {
      throw new BadRequestException(`Attendance of signup ${signupId} can't be changed: not active, cancelled or paid out`)
    }

    await this.redisCacheService.reset()

    return [
      updated,
      [
        {
          entity: AuditLogEntity.TRAINING_SIGNUP,
          entityId: updated.id,
          operation: AuditLogOperation.UPDATE,
          payload: values,
          timestamp: new Date().toISOString(),
          metadata: { serviceName: TrainingSignupService.name, methodName: this.setAttendance.name },
        },
      ],
    ]
  }

  async getTrainingSignupByPassId(passId: string) {
    const cachekey = TrainingSignupCacheKey.signupsByPassId(passId)

    const cachedSignups = await this.redisCacheService.get<typeof result>(cachekey)
    if (cachedSignups) {
      return cachedSignups
    }

    const result = await this.databaseService.drizzle.query.trainingSignup.findMany({
      where: (ts, { eq, and }) => and(eq(ts.passId, passId), ne(ts.status, TrainingSignupStatusEnum.CANCELED)),
      with: {
        training: true,
        group: true,
      },
    })

    if (result) {
      this.redisCacheService.set(cachekey, result)
    }
    return result
  }

  private async checkIfHasTrialSignup(userProfileId: string): Promise<boolean> {
    const [signups] = await this.findTrainingSignupsByCondition({
      userProfileId,
      status: TrainingSignupStatusEnum.ACTIVE,
      type: TrainingSignupTypeEnum.TRIAL,
    })

    return !!signups
  }

  private async checkIfAlreadySignedUpForTraining(userProfileId: string, trainingId: number) {
    const cacheKey = TrainingSignupCacheKey.trainingAlreadyBooked(userProfileId, trainingId)
    const cachedSignup = await this.redisCacheService.get<typeof existingSignup>(cacheKey)
    if (cachedSignup) {
      return cachedSignup
    }
    const existingSignup = await this.databaseService.drizzle.query.trainingSignup.findFirst({
      where: (ts, { eq, and }) => and(eq(ts.userProfileId, userProfileId), eq(ts.trainingId, trainingId)),
      with: {
        training: true,
      },
    })
    if (existingSignup) {
      this.redisCacheService.set(cacheKey, existingSignup)
    }
    return existingSignup
  }

  private async signUpForTraining(
    values: Omit<TrainingSignupInsertModel, 'status'>,
    tx?: Transaction,
  ): Promise<[TrainingSignupSelectModel, AuditLogServiceOperation[]]> {
    const dbProvider = tx || this.databaseService.drizzle
    const [createdSignUp] = await dbProvider
      .insert(trainingSignup)
      .values({ ...values, status: TrainingSignupStatusEnum.ACTIVE })
      .returning()

    return [
      createdSignUp,
      [
        {
          entity: AuditLogEntity.TRAINING_SIGNUP,
          entityId: createdSignUp.id,
          operation: AuditLogOperation.CREATE,
          payload: values,
          timestamp: new Date().toISOString(),
          metadata: { serviceName: TrainingSignupService.name, methodName: this.signUpForTraining.name },
        },
      ],
    ]
  }

  private async signOutFromTraining(values: { id: string }, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle
    return dbProvider.delete(trainingSignup).where(eq(trainingSignup.id, values.id)).returning()
  }
}
