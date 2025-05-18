import { Injectable, NotFoundException } from '@nestjs/common'
import { StudioService } from '../studio'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import {
  DatabaseService,
  GroupScheduleSelectModel,
  PassSelectModel,
  training,
  TrainingInsertModel,
} from '@app/infrastructure/database'
import { PassService } from '../pass'
import { DATE_FORMAT, UserProfileRoleEnum } from '@app/libs'
import { RedisCacheService, TrainingCacheKey } from '@app/infrastructure/redis'

@Injectable()
export class TrainingService {

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeService: DateTimeProvider,
    private readonly databaseService: DatabaseService,
    private readonly studioService: StudioService,
    private readonly passService: PassService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

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
    return result
  }

  async getTrainingsListForSchedule(options: { groupId: string; clientId?: string; userId: string; role: UserProfileRoleEnum }) {
    const { groupId, clientId, userId, role } = options
    const cacheKey = TrainingCacheKey.trainingsForSchedule(groupId, userId)

    const cachedTrainings = await this.redisCacheService.get<typeof trainings>(cacheKey)
    if (cachedTrainings) {
      return cachedTrainings
    }

    let pass: PassSelectModel | null = null

    if (role === UserProfileRoleEnum.CLIENT) {
      console.log('RENDERS PASS')
      pass = await this.passService.findActivePassByClientId(clientId)
    }

    const trainings = await this.databaseService.drizzle.query.training.findMany({
      where: (training, { eq, and, lte, gte }) =>
        and(
          eq(training.groupId, groupId),
          eq(training.isCancelled, false),
          gte(training.date, this.dateTimeService.formatDate({ dateFormat: DATE_FORMAT.DB })),
          // lte(training.date, pass ? pass.endDate : ), // finish add 1 week for guest
        ),
      with: {
        group: true,
        groupSchedule: true,
      },
    })

    if (trainings) {
      this.redisCacheService.set(cacheKey, trainings)
    }

    return trainings
  }

  async getTrainingById(trainingId: string) {
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
      },
    })
    if (!training) {
      throw new NotFoundException(`Training with id: ${trainingId} not found`)
    }

    this.redisCacheService.set(cacheKey, training)

    return training
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
        date: this.dateTimeService.toISOStringWithTz(this.dateTimeService.addTimeToDate(date, schedule.time)),
        groupId: groupId,
        groupScheduleId: schedule.id,
        trainerId: trainerId,
      }
      trainingsToInsert.push(trainingRecord)
    })
    return trainingsToInsert
  }
}
