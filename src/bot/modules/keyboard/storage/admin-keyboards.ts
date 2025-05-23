import { KeyboardHelper } from '@app/bot/helpers'
import { KEYBOARDS_ADMIN } from '@app/bot/static/keyboards'
import { TReplyMarkupKeyboard } from '@app/bot/libs'

export class AdminKeyboards {
  static mainMenu(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_ADMIN.MAIN_MENU)
  }
}
