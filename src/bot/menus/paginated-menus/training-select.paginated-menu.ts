import { Injectable, Scope } from '@nestjs/common'
import { TrainingService } from '@app/domain/training'
import { DATE_FORMAT, UserProfileRoleEnum } from '@app/libs'
import { GetGroupByIdResponse, TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { TextHelper } from '@app/bot/helpers'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { MESSAGES_CLIENT } from '@app/bot/static/messages'

type TTrainingSelectMenuParams = {
  group: GetGroupByIdResponse
  userId: string
  clientId?: string
  role: UserProfileRoleEnum
}

@Injectable({ scope: Scope.TRANSIENT })
export class TrainingSelectPaginatedMenu extends BasePaginatedSelectInlineMenu<TTrainingSelectMenuParams> {
  constructor(
    private readonly trainingService: TrainingService,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    super()
  }

  protected getPromptMessage({ group }: TTrainingSelectMenuParams): string | undefined {
    if (!group) return undefined

    const messageString =
      `Обрана група: ${group.name}\n\n` +
      `${group.groupAgeRestrictions ? `${MessageHelper.getAgeRestrictionMessage(group.groupAgeRestrictions.minAge, group.groupAgeRestrictions.maxAge)}\n\n` : ''}` +
      `${MESSAGES_CLIENT.CHOOSE_TRAINING}`

    return messageString.trim()
  }

  protected async loadOptions(params: TTrainingSelectMenuParams): Promise<TNormalizedOption[]> {
    const { group, clientId, userId, role } = params

    if (!group) throw new Error('Missing groupId for training menu')

    const trainings = await this.trainingService.getTrainingsListForSchedule({ groupId: group.id, clientId, userId, role })

    return trainings.map((training) => {
      const date = TextHelper.capitalize(this.dateTimeProvider.formatDateStringInTz(training.date, DATE_FORMAT.TRAINING_DISPLAY))
      return {
        label: `✨ ${date}`,
        value: training.id,
      }
    })
  }
}
