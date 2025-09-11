import { Injectable, Scope } from '@nestjs/common'
import { KeyboardHelper } from '@app/bot/helpers'
import { TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { TrainingSelectModel, TrainingSignupSelectModel } from '@app/infrastructure/database'


@Injectable({ scope: Scope.TRANSIENT })
export class ActiveSchedulesPaginatedMenu extends BasePaginatedSelectInlineMenu<{
  data: (TrainingSignupSelectModel & { training: TrainingSelectModel; group: { groupStyle: { title: string } } })[]
}> {
  constructor(@DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider) {
    super()
  }

  protected async loadOptions(): Promise<TNormalizedOption[]> {
    const { data } = this.sessionParams

    const normallizedSignups = data.map((signup) => ({
      text: `${signup.group.groupStyle.title} (${this.dateTimeProvider.formatDateStringInTz(signup.training.date, 'dd.MM.yyyy HH:mm')})`,
      id: signup.id,
    }))

    return KeyboardHelper.prepareInlineMenuOptions(normallizedSignups, {
      labelKey: ['text'],
      valueKey: 'id',
      emoji: '➖',
    })
  }
}
