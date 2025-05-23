import { Injectable } from '@nestjs/common'
import { TrainingService } from '@app/domain/training'
import { DATE_FORMAT, UserProfileRoleEnum } from '@app/libs'
import { TNormalizedOption } from '@app/bot/libs'
import { BaseSelectInlineMenu } from './base.paginated-menu'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'

@Injectable()
export class TrainingSelectInlineMenu extends BaseSelectInlineMenu<{
  groupId: string
  userId: string
  clientId?: string
  role: UserProfileRoleEnum
}> {
  constructor(
    private readonly trainingService: TrainingService,
    @DateTimeProviderInjector() private readonly dateTimeService: DateTimeProvider,
  ) {
    super()
  }

  protected async loadOptions(): Promise<TNormalizedOption[]> {
    const { groupId, clientId, userId, role } = this.sessionParams

    if (!groupId) throw new Error('Missing groupId for training menu')

    const trainings = await this.trainingService.getTrainingsListForSchedule({ groupId, clientId, userId, role })

    return trainings.map((training) => {
      const date = this.dateTimeService.formatDateStringInTz(training.date, DATE_FORMAT.TRAINING_DISPLAY)
      return {
        label: `➕ ${date}`,
        value: training.id,
      }
    })
  }
}
