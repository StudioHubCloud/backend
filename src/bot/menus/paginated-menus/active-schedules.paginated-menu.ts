import { Injectable, Scope } from '@nestjs/common'
import { KeyboardHelper } from '@app/bot/helpers'
import { TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { TrainingSelectModel, TrainingSignupSelectModel } from '@app/infrastructure/database'


type TActiveSchedulesMenuParams = {
  data: (TrainingSignupSelectModel & { training: TrainingSelectModel; group: { groupStyle: { title: string } } })[]
}

@Injectable({ scope: Scope.TRANSIENT })
export class ActiveSchedulesPaginatedMenu extends BasePaginatedSelectInlineMenu<TActiveSchedulesMenuParams> {
  constructor(@DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider) {
    super()
  }

  protected async loadOptions(params: TActiveSchedulesMenuParams): Promise<TNormalizedOption[]> {
    const { data } = params

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
