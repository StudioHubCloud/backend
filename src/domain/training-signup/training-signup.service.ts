import { forwardRef, Inject, Injectable } from '@nestjs/common'
import {
  DatabaseService,
  trainingSignup,
  TrainingSignupInsertModel,
  TrainingSignupSelectModel,
  Transaction,
} from '@app/infrastructure/database'
import { API, GroupStatusEnum, PassStatusEnum, TrainingSignupStatusEnum, TrainingSignupTypeEnum } from '@app/libs/constants'
import { TCustomApiResponse } from '@app/libs/types'
import { PassService } from '../pass/pass.service'
import { TrainingService } from '../training/training.service'
import { GroupAgeRestrictionService } from '../group-age-restriction/group-age-restriction.service'
import { PinoLogger } from 'nestjs-pino'
import { RedisCacheService, TrainingCacheKey, TrainingSignupCacheKey } from '@app/infrastructure/redis'
import { and, eq } from 'drizzle-orm'

@Injectable()
export class TrainingSignupService {
  constructor(
    @Inject(forwardRef(() => TrainingService))
    private readonly trainingService: TrainingService,
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
    private readonly passService: PassService,
    private readonly groupAgeRestrictionService: GroupAgeRestrictionService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async findTrainingSignupsByCondition(conditions: Partial<TrainingSignupSelectModel>) {
    return this.databaseService.drizzle.query.trainingSignup.findMany({
      where: (ts, { eq, and }) => and(...Object.entries(conditions).map(([key, value]) => eq(ts[key], value))),
    })
  }

  async getClientSignups(userProfileId: string) {
    const cache_key = TrainingSignupCacheKey.clientSignups(userProfileId)
    const cachedSignups = await this.redisCacheService.get<typeof signups>(cache_key)
    if (cachedSignups) {
      return cachedSignups
    }
    const signups = await this.databaseService.drizzle.query.trainingSignup.findMany({
      where: (ts, { eq }) => eq(ts.userProfileId, userProfileId),
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

  async getClientGroupSignups(userProfileId: string, groupId: string) {
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
    trainingId: string
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
        return { status: API.RESPONSE.ERROR_STRING, message: 'Запис неможливий. Група не знайдена або неактивна 😔' }
      }
      if (!ageRestrictionPassed) {
        this.logger.warn('User %s does not pass age restriction for group %s', userProfileId, training.groupId)
        return { status: API.RESPONSE.ERROR_STRING, message: 'Вибачте, ви не відповідаєте віковим обмеженням цієї групи 😔' }
      }

      if (isAlreadySignedUp) {
        this.logger.warn('User %s is already signed up for training %s', userProfileId, trainingId)
        return { status: API.RESPONSE.ERROR_STRING, message: 'Ви вже записані на це тренування 😅' }
      }

      if (!pass) {
        this.logger.warn('Pass %s is not found or inactive', passId)
        return { status: API.RESPONSE.ERROR_STRING, message: 'Упс! 🤸‍♀️ Активний абонемент відсутній. Час оновити! 😉🔥' }
      }
      if (pass.availableSlots <= 0) {
        this.logger.warn('User %s has no available slots in pass %s', userProfileId, passId)
        return { status: API.RESPONSE.ERROR_STRING, message: 'Ви використали всі тренування в рамках цього абонементу 😥' }
      }
      if (training.isCancelled) {
        this.logger.warn('Training %s is cancelled', trainingId)
        return { status: API.RESPONSE.ERROR_STRING, message: 'На жаль, тренування було скасовано 😔' }
      }

      const [updatedPass] = await this.databaseService.drizzle.transaction(async (tx) => {
        return Promise.all([
          this.passService.updatePass(pass.id, { availableSlots: pass.availableSlots - 1 }, tx),
          this.signUpForTraining(
            {
              ...values,
              groupId: training.groupId,
              type: TrainingSignupTypeEnum.MAIN,
            },
            tx,
          ),
        ])
      })

      await this.redisCacheService.reset()

      return {
        status: API.RESPONSE.SUCCESS_STRING,
        availableSlots: updatedPass.availableSlots,
        message: 'Вітаю, запис успішний!🤗',
      }
    } catch (error) {
      this.logger.error(`Error signing up for training %s for user %s: %j`, userProfileId, trainingId, error.stack)
      return {
        status: API.RESPONSE.ERROR_STRING,
        message: 'Виникла помилка при записі на тренування 😔',
      }
    }
  }

  async signUpForTrainingAsGuestViaTelegram(values: { trainingId: string; userProfileId: string }): Promise<TCustomApiResponse> {
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
          group: {
            columns: {
              id: true,
            },
          },
        },
      })

      if (!signup) {
        return { status: API.RESPONSE.ERROR_STRING, message: 'Запис не знайдено' }
      }

      if (signup.status !== TrainingSignupStatusEnum.ACTIVE) {
        return { status: API.RESPONSE.ERROR_STRING, message: 'Запис не активний' }
      }
      if (signup.type === TrainingSignupTypeEnum.TRIAL || !signup.pass) {
        return { status: API.RESPONSE.ERROR_STRING, message: 'Виписка з пробного запису недоступна' }
      }

      await this.databaseService.drizzle.transaction(async (tx) => {
        return Promise.all([
          this.passService.updatePass(signup.pass!.id, { availableSlots: signup.pass!.availableSlots + 1 }, tx),
          this.signOutFromTraining({ id: signup.id }, tx),
        ])
      })

      await this.redisCacheService.reset()

      return { status: API.RESPONSE.SUCCESS_STRING, message: 'Виписка з тренування успішна' }
    } catch (error) {
      this.logger.error(`Error signing out from training %s: %j`, trainingSignupId, error.stack)
      return {
        status: API.RESPONSE.ERROR_STRING,
        message: 'Виникла помилка при виписці з тренування 😔',
      }
    }
  }

  async getTrainingActiveSignups(trainingId: string) {
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
      },
    })
    if (result) {
      this.redisCacheService.set(cacheKey, result)
    }
    return result
  }
  async getTrainingCancelledSignups(trainingId: string) {
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
      },
    })
    if (result) {
      this.redisCacheService.set(cacheKey, result)
    }
    return result
  }

  async cancelAllActiveTrainingSignupsForTraining(trainingId: string, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle

    const cacheKeyActive = TrainingSignupCacheKey.trainingActiveSignups(trainingId)
    const cacheKeyCanceled = TrainingSignupCacheKey.trainingCanceledSignups(trainingId)
    this.redisCacheService.delete(cacheKeyActive)
    this.redisCacheService.delete(cacheKeyCanceled)

    const result = await dbProvider
      .update(trainingSignup)
      .set({ status: TrainingSignupStatusEnum.CANCELED })
      .where(and(eq(trainingSignup.trainingId, trainingId), eq(trainingSignup.status, TrainingSignupStatusEnum.ACTIVE)))
      .returning()

    return result
  }

  async activateAllCancelledTrainingSignupsForTraining(trainingId: string, tx?: Transaction) {
    const dbProvider = tx || this.databaseService.drizzle

    const cacheKeyActive = TrainingSignupCacheKey.trainingActiveSignups(trainingId)
    const cacheKeyCanceled = TrainingSignupCacheKey.trainingCanceledSignups(trainingId)
    this.redisCacheService.delete(cacheKeyActive)
    this.redisCacheService.delete(cacheKeyCanceled)
    
    const result = await dbProvider
      .update(trainingSignup)
      .set({ status: TrainingSignupStatusEnum.ACTIVE })
      .where(and(eq(trainingSignup.trainingId, trainingId), eq(trainingSignup.status, TrainingSignupStatusEnum.CANCELED)))
      .returning()
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

  private async checkIfAlreadySignedUpForTraining(userProfileId: string, trainingId: string) {
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
