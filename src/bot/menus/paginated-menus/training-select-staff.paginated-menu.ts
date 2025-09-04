import { Injectable, NotFoundException, Scope } from '@nestjs/common'
import { TrainingService } from '@app/domain/training'
import { DATE_FORMAT } from '@app/libs'
import { TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { GroupSelectModel, TrainingSelectModel, TrainingSignupSelectModel } from '@app/infrastructure/database'
import { TextHelper } from '@app/bot/helpers'

@Injectable({ scope: Scope.TRANSIENT })
export class TrainingSelectStaffPaginatedMenu extends BasePaginatedSelectInlineMenu<{
  group?: GroupSelectModel
  trainings?: (TrainingSelectModel & { trainingSignups: TrainingSignupSelectModel[] })[]
}> {
  constructor(
    private readonly trainingService: TrainingService,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    super()
  }

  protected async loadOptions(): Promise<TNormalizedOption[] | { message: string }> {
    if (!this.sessionParams) {
      return { message: 'Меню застаріле, ініціюйте його знову.' }
    }

    if (this.sessionParams.trainings) {
      this.config.promptMessage = `Найближчі тренування:`
      this.config.noOptionsMessage = `У найближчі 7 днів тренувань не знайдено`
      return this.renderTrainingsMenu(this.sessionParams.trainings)
    } else {
      const { group } = this.sessionParams

      if (!group) return []

      const trainings = await this.trainingService.getTrainingListForManage({ groupId: group.id })
      this.config.promptMessage = `Тренування групи: ${group.name}:`

      return this.renderTrainingsMenu(trainings)
    }
  }

  private renderTrainingsMenu(trainings: (TrainingSelectModel & { trainingSignups: TrainingSignupSelectModel[] })[] = []) {
    return trainings.map((training) => {
      const emoji = training.isCancelled ? '🚫' : '🔸'
      const countString = training.trainingSignups.length > 0 ? ` [${training.trainingSignups.length}]` : ''

      const date = TextHelper.capitalize(this.dateTimeProvider.formatDateStringInTz(training.date, DATE_FORMAT.TRAINING_DISPLAY))
      return {
        label: `${emoji} ${date}${countString}`,
        value: training.id,
      }
    })
  }
}
