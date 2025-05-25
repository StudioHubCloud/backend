import { Injectable, NotFoundException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { StudioService } from '../studio'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { DatabaseService, GroupScheduleSelectModel, training, TrainingInsertModel } from '@app/infrastructure/database'
import { PassService } from '../pass'
import { API, UserProfileRoleEnum } from '@app/libs'
import { RedisCacheService, TrainingCacheKey } from '@app/infrastructure/redis'
import { GetTrainingByIdResponse } from '@app/bot/libs'

@Injectable()
export class TrainingService {
  constructor(
    @DateTimeProviderInjector() private readonly dateTimeService: DateTimeProvider,
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
      },
      orderBy: (training, { asc }) => asc(training.date),
    })

    if (trainings) {
      this.redisCacheService.set(cacheKey, trainings)
    }

    return trainings
  }

  async cancelTrainingById(trainingId: string) {
    await this.getTrainingById(trainingId)
    const [result] = await this.databaseService.drizzle
      .update(training)
      .set({ isCancelled: true })
      .where(eq(training.id, trainingId))
      .returning()
    await this.redisCacheService.reset()
    return result
  }

  async activateTrainingById(trainingId: string) {
    await this.getTrainingById(trainingId)
    const [result] = await this.databaseService.drizzle
      .update(training)
      .set({ isCancelled: false })
      .where(eq(training.id, trainingId))
      .returning()
    await this.redisCacheService.reset()
    return result
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

    const trainings = await this.databaseService.drizzle.query.training.findMany({
      where: (training, { eq, and, lte, gte }) =>
        and(
          eq(training.groupId, groupId),
          eq(training.isCancelled, false),
          gte(training.date, new Date().toISOString()),
          lte(training.date, pass.endDate),
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
    const interval = this.dateTimeService.getNextMonthDateInterval()
    let trainingsToInsert: TrainingInsertModel[] = []

    studios.forEach((studio) => {
      studio.groups.forEach((group) => {
        group.groupSchedules.forEach((schedule) => {
          const trainingDates = this.dateTimeService.getEachDayOfIntervalForDayIndex(interval, schedule.groupScheduleDays.dayIndex)
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

  private generateTrainingsRecords(
    trainingDates: Date[],
    groupId: string,
    schedule: GroupScheduleSelectModel,
    trainerId: string | null,
  ) {
    const trainingsToInsert: TrainingInsertModel[] = []

    trainingDates.forEach((date) => {
      const trainingRecord = {
        date: this.dateTimeService.getUtcStringTz(this.dateTimeService.addTimeToDate(date, schedule.time)),
        groupId: groupId,
        groupScheduleId: schedule.id,
        trainerId: trainerId,
      }
      trainingsToInsert.push(trainingRecord)
    })
    return trainingsToInsert
  }
}
