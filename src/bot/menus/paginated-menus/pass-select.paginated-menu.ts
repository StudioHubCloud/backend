import { Injectable, Scope } from '@nestjs/common'
import { KeyboardHelper } from '@app/bot/helpers'
import { TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'

type TPassSelectMenuParams = {
  /** Prompt shown above the passes (e.g. the warning why a choice is needed) */
  prompt?: string
  data?: { id: string; name: string }[]
}

/** A list of the client's passes to choose from (admin signs a client into a group without a covering pass). */
@Injectable({ scope: Scope.TRANSIENT })
export class PassSelectPaginatedMenu extends BasePaginatedSelectInlineMenu<TPassSelectMenuParams> {
  constructor() {
    super()
  }

  protected getPromptMessage(params: TPassSelectMenuParams): string | undefined {
    return params.prompt
  }

  protected async loadOptions(params: TPassSelectMenuParams): Promise<TNormalizedOption[]> {
    return KeyboardHelper.prepareInlineMenuOptions(params.data ?? [], { labelKey: ['name'], valueKey: 'id' })
  }
}
