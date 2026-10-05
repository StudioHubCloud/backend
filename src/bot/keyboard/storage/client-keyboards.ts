import { InlineKeyboardButton } from '@telegraf/types'
import { KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { KEYBOARDS_CLIENT } from '@app/bot/static/keyboards'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { CALLBACK_PREFIX, TReplyInlineKeyboard, TReplyMarkupKeyboard } from '@app/bot/libs'
import { PassSelectionHelper, TLabelPass } from '@app/domain/pass'
import { COMMON_BUTTONS } from './common-keyboards'

export class ClientKeyboards {
  static mainMenu(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_CLIENT.MAIN_MENU)
  }

  /** "🎫 Інформація про абонемент" with several active passes: one per pass, the current one ✅ and green. */
  static passSwitch(passes: (TLabelPass & { id: string })[], currentPassId: string, { withRules = false } = {}): TReplyInlineKeyboard {
    const rows: InlineKeyboardButton[][] = passes.map((pass) => {
      const isCurrent = pass.id === currentPassId
      const button: InlineKeyboardButton = {
        text: `${isCurrent ? '✅ ' : ''}${PassSelectionHelper.getLabel(pass)}`,
        callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.CLIENT.PASS_SWITCH, pass.id),
      }
      return [isCurrent ? KeyboardHelper.withStyle(button, 'success') : button]
    })

    if (withRules) {
      rows.push([{ text: BUTTON_PATTERNS.INDIVIDUAL_PASS_RULES, callback_data: CALLBACK_PREFIX.CLIENT.PASS_RULES }])
    }
    rows.push([COMMON_BUTTONS.CLOSE]) // the client's pass card is a root menu

    return KeyboardHelper.createInlineKeyboard(rows)
  }
}
