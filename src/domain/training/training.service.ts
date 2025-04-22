import { Injectable } from '@nestjs/common'
import { StudioService } from '../studio'
import { DateTimeService, DateTimeServiceInjector } from '@app/infrastructure/providers'
import { DatabaseService, GroupScheduleSelectModel, training, TrainingInsertModel } from '@app/infrastructure/database'

@Injectable()
export class TrainingService {
  constructor(
    @DateTimeServiceInjector() private readonly dateTimeService: DateTimeService,
    private readonly databaseService: DatabaseService,
    private readonly studioService: StudioService,
  ) {}

  async addTrainingsForActiveGroups() {
    const studios = await this.studioService.getAllStudiosWithActiveGroups({ allowTrainingInsertCron: true })
    const interval = this.dateTimeService.getNextMonthDateInterval()
    let trainingsToInsert: TrainingInsertModel[] = []

    studios.forEach((studio) => {
      studio.groups.forEach((group) => {
        group.groupSchedules.forEach((schedule) => {
          const trainingDates = this.dateTimeService.getEachDayOfIntervalForDayIndex(interval, schedule.groupScheduleDays.dayIndex)
          trainingsToInsert = [...trainingsToInsert, ...this.generateTrainingsRecords(trainingDates, group.id, schedule)]
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

  private generateTrainingsRecords(trainingDates: Date[], groupId: string, schedule: GroupScheduleSelectModel) {
    const trainingsToInsert: TrainingInsertModel[] = []

    trainingDates.forEach((date) => {
      const trainingDate = this.dateTimeService.addTimeToDate(date, schedule.time).toISOString()
      const trainingRecord = {
        date: trainingDate,
        groupId: groupId,
        groupScheduleId: schedule.id,
      }
      trainingsToInsert.push(trainingRecord)
    })
    return trainingsToInsert
  }
}
