import { Injectable, Scope } from '@nestjs/common'
import { TrainingService } from '@app/domain/training'
import { DATE_FORMAT } from '@app/libs'
import { COMMON, TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { GroupSelectModel, TrainingSelectModel, TrainingSignupSelectModel } from '@app/infrastructure/database'
import { TextHelper } from '@app/bot/helpers'

type TTrainingSelectStaffMenuParams = {
  group?: GroupSelectModel
  trainings?: (TrainingSelectModel & { trainingSignups: TrainingSignupSelectModel[] })[]
}

@Injectable({ scope: Scope.TRANSIENT })
export class TrainingSelectStaffPaginatedMenu extends BasePaginatedSelectInlineMenu<TTrainingSelectStaffMenuParams> {
  constructor(
    private readonly trainingService: TrainingService,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    super()
  }

  protected getPromptMessage({ trainings, group }: TTrainingSelectStaffMenuParams): string | undefined {
    if (trainings) return `📅 Мої тренування на найближчі ${COMMON.INCOMING_TRAININGS_DAYS_RANGE} днів:`
    if (group) return `🗓 Тренування групи:\n\n <i><b>${group.name}</b></i>`
    return undefined
  }

  protected getNoOptionsMessage({ trainings, group }: TTrainingSelectStaffMenuParams): string | undefined {
    if (trainings) return `😔 У найближчі ${COMMON.INCOMING_TRAININGS_DAYS_RANGE} днів тренувань не знайдено`
    if (group) return '📅 В цій групі немає доступних тренувань'
    return undefined
  }

  protected async loadOptions(params: TTrainingSelectStaffMenuParams): Promise<TNormalizedOption[]> {
    if (params.trainings) {
      return this.renderTrainingsMenu(params.trainings)
    }

    const { group } = params

    if (!group) return []

    const trainings = await this.trainingService.getTrainingListForManage({ groupId: group.id })

    return this.renderTrainingsMenu(trainings)
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
