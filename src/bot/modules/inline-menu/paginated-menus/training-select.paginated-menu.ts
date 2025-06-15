import { Injectable, Scope } from '@nestjs/common'
import { TrainingService } from '@app/domain/training'
import { DATE_FORMAT, UserProfileRoleEnum } from '@app/libs'
import { TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { TextHelper } from '@app/bot/helpers'

@Injectable({scope: Scope.TRANSIENT})
export class TrainingSelectPaginatedMenu extends BasePaginatedSelectInlineMenu<{
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
      const date = TextHelper.capitalize(this.dateTimeService.formatDateStringInTz(training.date, DATE_FORMAT.TRAINING_DISPLAY)) 
      return {
        label: `✨ ${date}`,
        value: training.id,
      }
    })
  }
}
