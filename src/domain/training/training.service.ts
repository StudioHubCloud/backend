import { BadRequestException, Injectable } from '@nestjs/common'
import { StudioService } from '../studio'
import { DateTimeService, DateTimeServiceInjector } from '@app/infrastructure/providers'
import { DatabaseService, GroupScheduleSelectModel, training, TrainingInsertModel } from '@app/infrastructure/database'
import { UserProfileService } from '../user-profile'
import { PassService } from '../pass'
import { DATE_FORMAT } from '@app/libs'

@Injectable()
export class TrainingService {
  constructor(
    @DateTimeServiceInjector() private readonly dateTimeService: DateTimeService,
    private readonly databaseService: DatabaseService,
    private readonly studioService: StudioService,
    private readonly userProfileService: UserProfileService,
    private readonly passService: PassService,
  ) {}

  async addTrainingsForActiveGroups() {
    const studios = await this.studioService.getAllStudiosWithActiveGroups({ allowTrainingInsertCron: true })
    const interval = this.dateTimeService.getNextMonthDateInterval()
    let trainingsToInsert: TrainingInsertModel[] = []

    studios.forEach((studio) => {
      studio.groups.forEach((group) => {
        group.groupSchedules.forEach((schedule) => {
          const trainingDates = this.dateTimeService.getEachDayOfIntervalForDayIndex(interval, schedule.groupScheduleDays.dayIndex)
          trainingsToInsert = [...trainingsToInsert, ...this.generateTrainingsRecords(trainingDates, group.id, schedule, group.staffMemberId)]
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

  async getTrainingsListForSchedule(groupId: string, telegramId: number) {
    const user = await this.userProfileService.getTelegramAuthenticatedUser(telegramId)

    if (!user) {
      throw new BadRequestException('Користувач не знайдений')
    }

    const pass = await this.passService.findPassByClientId(user['client']?.id)

    if (!pass) {
      throw new BadRequestException('Користувач не має абонементу')
    }

    const trainings = await this.databaseService.drizzle.query.training.findMany({
      where: (training, { eq, and, lte, gte }) =>
        and(
          eq(training.groupId, groupId),
          eq(training.isCancelled, false),
          gte(training.date, this.dateTimeService.formatDate({ dateFormat: DATE_FORMAT.DB })),
          lte(training.date, pass.endDate),
        ),
    })

    return trainings
  }

  private generateTrainingsRecords(trainingDates: Date[], groupId: string, schedule: GroupScheduleSelectModel, trainerId: string | null) {
    const trainingsToInsert: TrainingInsertModel[] = []

    trainingDates.forEach((date) => {
      const trainingDate = this.dateTimeService.addTimeToDate(date, schedule.time).toISOString()
      const trainingRecord = {
        date: trainingDate,
        groupId: groupId,
        groupScheduleId: schedule.id,
        trainerId: trainerId,
      }
      trainingsToInsert.push(trainingRecord)
    })
    return trainingsToInsert
  }
}
