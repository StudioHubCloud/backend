import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { PinoLogger } from 'nestjs-pino'
import { addDays, isAfter, isBefore, subHours } from 'date-fns'
import {
  DatabaseService,
  TrainingSelectModel,
  trainingSignup,
  TrainingSignupInsertModel,
  TrainingSignupSelectModel,
  Transaction,
  UserProfileSelectModel,
} from '@app/infrastructure/database'
import {
  API,
  DATE_FORMAT,
  GroupStatusEnum,
  PassStatusEnum,
  TrainingSignupStatusEnum,
  TrainingSignupTypeEnum,
} from '@app/libs/constants'
import { TCustomApiResponse } from '@app/libs/types'
import { PassService } from '../pass/pass.service'
import { TrainingService } from '../training/training.service'
import { GroupAgeRestrictionService } from '../group-age-restriction/group-age-restriction.service'
import { RedisCacheService, TrainingSignupCacheKey } from '@app/infrastructure/redis'
import { COMMON, PASS_CONFIG } from '@app/bot/libs'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { UserProfileService } from '../user-profile'

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

  async signUpForTrainingAsClientViaTelegram(values: {
    trainingId: number
    userProfileId: string
    passId: string
  }): Promise<TCustomApiResponse & { availableSlots?: number }> {
    const { passId, trainingId, userProfileId } = values
    try {
      const [pass, training, isAlreadySignedUp] = await Promise.all([
        this.passService.findPassByConditions({ id: passId, status: PassStatusEnum.ACTIVE }),
        this.trainingService.getTrainingById(trainingId),
        this.checkIfAlreadySignedUpForTraining(userProfileId, trainingId),
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

      if (!pass) {
        this.logger.warn('Pass %s is not found or inactive', passId)
        return {
          status: API.RESPONSE.ERROR_STRING,
          message: `Упс! 🤸‍♀️ Усі тренування за цим абонементом використано 💥\nСаме час поновити абонемент ❤️‍🔥`,
        }
      }

      const isPassInactive = !pass.endDate || !pass.startDate

      if (isPassInactive) {
        const startDateString = this.dateTimeProvider.formatDateStringInTz(new Date().toISOString(), DATE_FORMAT.DATE_MAIN)
        const endDate = addDays(startDateString, PASS_CONFIG.DEFAULT_DURATION_IN_DAYS)

        if (endDate < new Date()) {
          this.logger.warn('Pass %s is expired', passId)
          return {
            status: API.RESPONSE.ERROR_STRING,
            message: `Упс! 🤸‍♀️ Термін дії абонемента закінчився 💥\nСаме час поновити абонемент ❤️‍🔥`,
          }
        }

        const endDateString = this.dateTimeProvider.formatDateStringInTz(endDate.toISOString(), DATE_FORMAT.DATE_MAIN)

        await this.passService.updatePass(passId, { startDate: startDateString, endDate: endDateString })
      }

      if (pass.availableSlots <= 0) {
        this.logger.warn('User %s has no available slots in pass %s', userProfileId, passId)
        return {
          status: API.RESPONSE.ERROR_STRING,
          message: `Упс! 🤸‍♀️ Усі тренування за цим абонементом використано 💥\nСаме час поновити абонемент ❤️‍🔥`,
        }
      }
      if (training.isCancelled) {
        this.logger.warn('Training %s is cancelled', trainingId)
        return {
          status: API.RESPONSE.ERROR_STRING,
          message: `На жаль, тренування було скасовано 😔\nПросимо вибачення за незручності — а поки ти завжди можеш обрати інше тренування🎀`,
        }
      }

      await this.signUpForTraining({
        ...values,
        groupId: training.groupId,
        type: TrainingSignupTypeEnum.MAIN,
      })

      await this.redisCacheService.reset()

      const updatedPass = await this.passService.findPassByConditions({ id: passId, status: PassStatusEnum.ACTIVE })

      if (!updatedPass) {
        this.logger.warn('Updated pass %s is not found after signup', passId)
        return {
          status: API.RESPONSE.ERROR_STRING,
          message: `Виникла помилка при записі на тренування 😔\nВідсутній активний абонемент`,
        }
      }

      return {
        status: API.RESPONSE.SUCCESS_STRING,
        availableSlots: updatedPass.availableSlots,
        message: '✅ Ти успішно записана на тренування в групі!\nЧекаємо на тебе🫶🏻',
      }
    } catch (error) {
      this.logger.error(`Error signing up for training %s for user %s: %j`, userProfileId, trainingId, error.stack)
      return {
        status: API.RESPONSE.ERROR_STRING,
        message: 'Виникла помилка при записі на тренування 😔',
      }
    }
  }

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

  async signOutFromTrainingAsAdminViaTelegram(
    trainingSignupId: string,
  ): Promise<TCustomApiResponse<{ userProfile: UserProfileSelectModel | null; training: TrainingSelectModel | null }>> {
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

      await this.signOutFromTraining({ id: signup.id })
      await this.redisCacheService.reset()

      return {
        status: API.RESPONSE.SUCCESS_STRING,
        message: `✅ Клієнта успішно виписано з тренування`,
        data: { userProfile: signup.userProfile, training: signup.training },
      }
    } catch (error) {
      this.logger.error(`Error signing out from training %s: %j`, trainingSignupId, error.stack)
      return {
        status: API.RESPONSE.ERROR_STRING,
        message: 'Виникла помилка при виписці з тренування 😔',
      }
    }
  }

  async signInToTrainingAsAdminViaTelegram(
    clientUserId: string,
    trainingId: number,
  ): Promise<TCustomApiResponse<{ groupId: number; userProfile: UserProfileSelectModel | null }>> {
    try {
      const [training, isAlreadySignedUp] = await Promise.all([
        this.trainingService.getTrainingById(trainingId),
        this.checkIfAlreadySignedUpForTraining(clientUserId, trainingId),
      ])

      if (!training) {
        return { status: API.RESPONSE.ERROR_STRING, message: '🥺 Тренування не знайдено' }
      }

      if (isAlreadySignedUp) {
        return { status: API.RESPONSE.ERROR_STRING, message: `Клієнт вже записаний на це тренування 💝` }
      }

      await this.signUpForTraining({
        trainingId,
        userProfileId: clientUserId,
        groupId: training.groupId,
        type: TrainingSignupTypeEnum.MAIN,
      })

      const [userProfile] = await Promise.all([
        this.userProfileService.getUserProfileById(clientUserId),
        this.redisCacheService.reset(),
      ])

      return {
        status: API.RESPONSE.SUCCESS_STRING,
        message: '✅ Клієнта успішно записано на тренування',
        data: { groupId: training.groupId, userProfile },
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
          or(eq(ts.type, TrainingSignupTypeEnum.MAIN), eq(ts.type, TrainingSignupTypeEnum.TRIAL)),
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
          or(eq(ts.type, TrainingSignupTypeEnum.MAIN), eq(ts.type, TrainingSignupTypeEnum.TRIAL)),
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

  private async signUpForTraining(values: Omit<TrainingSignupInsertModel, 'status'>, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle
    return dbProvider
      .insert(trainingSignup)
      .values({ ...values, status: TrainingSignupStatusEnum.ACTIVE })
      .returning()
  }

  private async signOutFromTraining(values: { id: string }, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle
    return dbProvider.delete(trainingSignup).where(eq(trainingSignup.id, values.id)).returning()
  }
}
