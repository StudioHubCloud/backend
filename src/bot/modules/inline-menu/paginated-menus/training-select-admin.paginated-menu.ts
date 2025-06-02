import { Injectable, NotFoundException, Scope } from '@nestjs/common'
import { TrainingService } from '@app/domain/training'
import { DATE_FORMAT } from '@app/libs'
import { TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { GroupSelectModel } from '@app/infrastructure/database'

@Injectable({ scope: Scope.TRANSIENT })
export class TrainingSelectAdminPaginatedMenu extends BasePaginatedSelectInlineMenu<{
  group: GroupSelectModel
}> {
  constructor(
    private readonly trainingService: TrainingService,
    @DateTimeProviderInjector() private readonly dateTimeService: DateTimeProvider,
  ) {
    super()
  }

  protected async loadOptions(): Promise<TNormalizedOption[] | { message: string }> {

    if (!this.sessionParams) {
      return {message: 'Меню застаріле, ініціюйте його знову.'}
    }

    const { group } = this.sessionParams


    if (!group) throw new NotFoundException('Missing group for training menu')

    const trainings = await this.trainingService.getTrainingListForManage({groupId: group.id})
    this.config.promptMessage = `Тренування групи: ${group.name}:`

    return trainings.map((training) => {
      const emoji = training.isCancelled ? '🚫' : '🔸'
      const countString = training.trainingSignups.length > 0 ? ` [${training.trainingSignups.length}]` : ''

      const date = this.dateTimeService.formatDateStringInTz(training.date, DATE_FORMAT.TRAINING_DISPLAY)
      return {
        label: `${emoji} ${date}${countString}`,
        value: training.id,
      }
    })
  }
}
