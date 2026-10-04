import { InlineKeyboardButton } from '@telegraf/types'
import { BotContext } from '@app/bot/bot.context'
import { BotHelper, KeyboardHelper } from '@app/bot/helpers'
import { TPickerItemState, TPickerItemStateResolver } from '@app/bot/libs'

/** Shared by CalendarPicker and TimePicker: item states on buttons and the disabled-item guard. */
export class PickerItemHelper {
  static async resolve(resolver: TPickerItemStateResolver | undefined, items: string[]) {
    return resolver ? await resolver(items) : {}
  }

  /** Prefixes the marker and sets the style. */
  static apply(button: InlineKeyboardButton, state?: TPickerItemState): InlineKeyboardButton {
    const marked = { ...button, text: `${state?.marker ?? ''}${button.text}` }
    return state?.style ? KeyboardHelper.withStyle(marked, state.style) : marked
  }

  /** True (and the alert is shown) when the pressed item is disabled; the picker then returns { type: 'navigated' }. */
  static async rejectIfDisabled(ctx: BotContext, resolver: TPickerItemStateResolver | undefined, item: string): Promise<boolean> {
    const state = (await this.resolve(resolver, [item]))[item]

    if (!state?.disabled) {
      return false
    }

    BotHelper.safeAnswerCbQuery(ctx, state.reason ?? '⛔️ Недоступно', { show_alert: true })
    return true
  }
}
