import { Injectable, Scope } from '@nestjs/common'
import { TrainingService } from '@app/domain/training'
import { DATE_FORMAT, UserProfileRoleEnum } from '@app/libs'
import { GetGroupByIdResponse, TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { TextHelper } from '@app/bot/helpers'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { MESSAGES_CLIENT } from '@app/bot/static/messages'

@Injectable({ scope: Scope.TRANSIENT })
export class TrainingSelectPaginatedMenu extends BasePaginatedSelectInlineMenu<{
  group: GetGroupByIdResponse
  userId: string
  clientId?: string
  role: UserProfileRoleEnum
}> {
  constructor(
    private readonly trainingService: TrainingService,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    super()
  }

  protected async loadOptions(): Promise<TNormalizedOption[]> {
    const { group, clientId, userId, role } = this.sessionParams

    if (!group) throw new Error('Missing groupId for training menu')

    const trainings = await this.trainingService.getTrainingsListForSchedule({ groupId: group.id, clientId, userId, role })

    const messageString =
      `Обрана група: ${group.name}\n\n` +
      `${group.groupAgeRestrictions ? `${MessageHelper.getAgeRestrictionMessage(group.groupAgeRestrictions.minAge, group.groupAgeRestrictions.maxAge)}\n\n` : ''}` +
      `${MESSAGES_CLIENT.CHOOSE_TRAINING}`
      
    this.config.promptMessage = messageString.trim()

    return trainings.map((training) => {
      const date = TextHelper.capitalize(this.dateTimeProvider.formatDateStringInTz(training.date, DATE_FORMAT.TRAINING_DISPLAY))
      return {
        label: `✨ ${date}`,
        value: training.id,
      }
    })
  }
}
