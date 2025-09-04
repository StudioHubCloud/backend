import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, gte } from 'drizzle-orm'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import {
  DatabaseService,
  group,
  GroupScheduleSelectModel,
  training,
  TrainingInsertModel,
  trainingSignup,
  userProfile,
} from '@app/infrastructure/database'
import { API, TrainingSignupStatusEnum, UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { RedisCacheService, TrainingCacheKey } from '@app/infrastructure/redis'
import { GetTrainingByIdResponse, PASS_CONFIG } from '@app/bot/libs'
import { PassService } from '../pass'
import { StudioService } from '../studio'
import { TrainingSignupService } from '../training-signup'
import { addDays } from 'date-fns'

@Injectable()
export class TrainingService {
  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    @Inject(forwardRef(() => TrainingSignupService))
    private readonly trainingSignupService: TrainingSignupService,
    private readonly databaseService: DatabaseService,
    private readonly studioService: StudioService,
    private readonly passService: PassService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async getTrainingListForManage({ groupId }: { groupId: string }) {
    const cacheKey = TrainingCacheKey.trainingsForManage(groupId)

    const cachedTrainings = await this.redisCacheService.get<typeof trainings>(cacheKey)
    if (cachedTrainings) {
      return cachedTrainings
    }

    const trainings = await this.databaseService.drizzle.query.training.findMany({
      where: (training, { eq, and, gte }) => and(eq(training.groupId, groupId), gte(training.date, new Date().toISOString())),
      limit: API.DEFAULT_LIMIT,
      with: {
        group: true,
        groupSchedule: true,
        trainingSignups: {
          where: (signup, { inArray }) =>
            inArray(signup.status, [TrainingSignupStatusEnum.ACTIVE, TrainingSignupStatusEnum.CANCELED]),
        },
      },
      orderBy: (training, { asc }) => asc(training.date),
    })

    if (trainings) {
      this.redisCacheService.set(cacheKey, trainings)
    }

    return trainings
  }

  async cancelTrainingById(trainingId: string) {
    const targetTraining = await this.getTrainingById(trainingId)

    if (targetTraining.isCancelled) {
      throw new BadRequestException(`Training with id: ${trainingId} is already cancelled`)
    }

    if (new Date(targetTraining.date) < new Date()) {
      throw new BadRequestException(`Training with id: ${trainingId} is in the past and cannot be canceled`)
    }

    const [result] = await this.databaseService.drizzle.transaction(async (tx) => {
      return await Promise.all([
        this.databaseService.drizzle
          .update(training)
          .set({ isCancelled: true })
          .where(and(eq(training.id, trainingId), gte(training.date, new Date().toISOString())))
          .returning(),
        this.trainingSignupService.cancelAllActiveTrainingSignupsForTraining(trainingId, tx),
      ])
    })

    await this.redisCacheService.reset()

    const cancelledSignUps = await this.trainingSignupService.getTrainingCancelledSignups(trainingId)
    return { training: result[0], signups: cancelledSignUps }
  }

  async activateTrainingById(trainingId: string) {
    const targetTraining = await this.getTrainingById(trainingId)

    if (!targetTraining.isCancelled) {
      throw new BadRequestException(`Training with id: ${trainingId} is not cancelled`)
    }
    if (new Date(targetTraining.date) < new Date()) {
      throw new BadRequestException(`Training with id: ${trainingId} is in the past and cannot be activated`)
    }

    const [result] = await this.databaseService.drizzle.transaction(async (tx) => {
      return await Promise.all([
        this.databaseService.drizzle
          .update(training)
          .set({ isCancelled: false })
          .where(and(eq(training.id, trainingId), gte(training.date, new Date().toISOString())))
          .returning(),
        this.trainingSignupService.activateAllCancelledTrainingSignupsForTraining(trainingId, tx),
      ])
    })

    await this.redisCacheService.reset()

    const activeSignUps = await this.trainingSignupService.getTrainingActiveSignups(trainingId)
    return { training: result[0], signups: activeSignUps }
  }

  async getTrainingsListForSchedule(options: { groupId: string; clientId?: string; userId: string; role: UserProfileRoleEnum }) {
    const { groupId, clientId, userId } = options
    const cacheKey = TrainingCacheKey.trainingsForSchedule(groupId, userId)

    const cachedTrainings = await this.redisCacheService.get<typeof trainings>(cacheKey)
    if (cachedTrainings) {
      return cachedTrainings
    }

    const pass = await this.passService.findActivePassByClientId(clientId)
    if (!pass) {
      return []
    }

    const startDateBoundary = new Date().toISOString()
    const endDateBoundary = pass.endDate || addDays(startDateBoundary, PASS_CONFIG.ACTIVATION_GRACE_PERIOD).toISOString()

    const trainings = await this.databaseService.drizzle.query.training.findMany({
      where: (training, { eq, and, lte, gte }) =>
        and(
          eq(training.groupId, groupId),
          eq(training.isCancelled, false),
          gte(training.date, startDateBoundary),
          lte(training.date, endDateBoundary),
        ),
      with: {
        group: true,
        groupSchedule: true,
      },
      orderBy: (training, { asc }) => asc(training.date),
    })

    if (trainings) {
      this.redisCacheService.set(cacheKey, trainings)
    }

    return trainings
  }

  async getTrainingListForReminder(trainingDateTimeIsoString: string) {
    return this.databaseService.drizzle.query.training.findMany({
      where: (training, { eq, and, lte, gte, exists }) =>
        and(
          eq(training.isCancelled, false),
          eq(training.reminderSent, false),
          gte(training.date, new Date().toISOString()),
          lte(training.date, trainingDateTimeIsoString),
          exists(
            this.databaseService.drizzle
              .select()
              .from(trainingSignup)
              .innerJoin(userProfile, eq(trainingSignup.userProfileId, userProfile.id))
              .where(
                and(
                  eq(trainingSignup.trainingId, training.id),
                  eq(trainingSignup.status, TrainingSignupStatusEnum.ACTIVE),
                  eq(userProfile.status, UserProfileStatusEnum.ACTIVE),
                ),
              ),
          ),
        ),
      with: {
        trainingSignups: {
          where: (signup, { eq }) => eq(signup.status, TrainingSignupStatusEnum.ACTIVE),
          with: {
            group: {
              columns: {
                name: true,
              },
              with: {
                groupStyle: {
                  columns: {
                    title: true,
                  },
                },
                groupAgeRestrictions: true,
              },
            },
            userProfile: true,
          },
        },
      },
    })
  }

  async updateTraining(trainingId: string, updateData: Partial<TrainingInsertModel>): Promise<TrainingInsertModel> {
    const targetTraining = await this.getTrainingById(trainingId)
    if (!targetTraining) {
      throw new NotFoundException(`Training with id: ${trainingId} not found`)
    }
    if (updateData.date && new Date(updateData.date) < new Date()) {
      throw new BadRequestException(`Training with id: ${trainingId} cannot be updated to a past date`)
    }

    const [updatedTraining] = await this.databaseService.drizzle
      .update(training)
      .set(updateData)
      .where(eq(training.id, trainingId))
      .returning()

    await this.redisCacheService.reset()

    return updatedTraining
  }

  async getTrainingById(trainingId: string): Promise<GetTrainingByIdResponse> {
    const cacheKey = TrainingCacheKey.trainingById(trainingId)

    const cachedTraining = await this.redisCacheService.get<typeof training>(cacheKey)
    if (cachedTraining) {
      return cachedTraining
    }

    const training = await this.databaseService.drizzle.query.training.findFirst({
      where: (training, { eq }) => eq(training.id, trainingId),
      with: {
        group: {
          columns: {
            status: true,
          },
        },
        groupSchedule: {
          with: {
            groupStyleVariant: true,
          },
        },
        trainingSignups: {
          with: {
            userProfile: true,
          },
        },
      },
    })
    if (!training) {
      throw new NotFoundException(`Training with id: ${trainingId} not found`)
    }

    this.redisCacheService.set(cacheKey, training)

    return training
  }

  async addTrainingsForActiveGroups() {
    const studios = await this.studioService.getAllStudiosWithActiveGroups({ allowTrainingInsertCron: true })
    const interval = this.dateTimeProvider.getNextTwoMonthDateInterval()
    let trainingsToInsert: TrainingInsertModel[] = []

    studios.forEach((studio) => {
      studio.groups.forEach((group) => {
        group.groupSchedules.forEach((schedule) => {
          const trainingDates = this.dateTimeProvider.getEachDayOfIntervalForDayIndex(interval, schedule.groupScheduleDays.dayIndex)
          trainingsToInsert = [
            ...trainingsToInsert,
            ...this.generateTrainingsRecords(trainingDates, group.id, schedule, group.staffMemberId),
          ]
        })
      })
    })

    const result = await this.databaseService.drizzle
      .insert(training)
      .values(trainingsToInsert)
      .onConflictDoNothing({ target: [training.date, training.groupId] })
      .returning()

    await this.redisCacheService.reset()
    return result
  }

  async getUpcomingTrainingsForStaff(userId: string) {
    const now = new Date().toISOString()
    const sevenDaysFromNow = addDays(now, PASS_CONFIG.INCOMING_TRAININGS_DAYS_RANGE).toISOString()

    return this.databaseService.drizzle.query.training.findMany({
      where: (training, { eq, and, gte, lte, exists, or, isNull }) =>
        and(
          gte(training.date, now),
          lte(training.date, sevenDaysFromNow),
          exists(
            this.databaseService.drizzle
              .select()
              .from(group)
              .where(
                and(
                  eq(group.id, training.groupId),
                  or(
                    // Direct trainer assignment matches
                    eq(training.trainerId, userId),
                    // Group assignment matches and no conflicting trainer assignment
                    and(eq(group.staffMemberId, userId), or(isNull(training.trainerId), eq(training.trainerId, userId))),
                  ),
                ),
              ),
          ),
        ),
      with: {
        group: true,
        trainingSignups: true,
      },
      orderBy: (training, { asc }) => asc(training.date),
    })
  }

  private generateTrainingsRecords(
    trainingDates: Date[],
    groupId: string,
    schedule: GroupScheduleSelectModel,
    trainerId: string | null,
  ) {
    const trainingsToInsert: TrainingInsertModel[] = []

    trainingDates.forEach((date) => {
      const trainingRecord = {
        date: this.dateTimeProvider.getUtcStringTz(this.dateTimeProvider.addTimeToDate(date, schedule.time)),
        groupId: groupId,
        groupScheduleId: schedule.id,
        trainerId: trainerId,
      }
      trainingsToInsert.push(trainingRecord)
    })
    return trainingsToInsert
  }
}
