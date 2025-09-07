import { Injectable, Scope } from '@nestjs/common'
import { KeyboardHelper } from '@app/bot/helpers'
import { TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'
import { TrainingSignupService } from '@app/domain/training-signup'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'

export const CLIENT_SIGNOUT_MENU = Symbol('client-signout-menu')

@Injectable({ scope: Scope.TRANSIENT })
export class ActiveSchedulesPaginatedMenu extends BasePaginatedSelectInlineMenu<{ userId: string }> {
  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly trainingSignupService: TrainingSignupService,
  ) {
    super()
  }

  protected async loadOptions(): Promise<TNormalizedOption[]> {
    const { userId } = this.sessionParams
    const activeSignups = await this.trainingSignupService.getClientSignups(userId)

    const normallizedSignups = activeSignups.map((signup) => ({
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
