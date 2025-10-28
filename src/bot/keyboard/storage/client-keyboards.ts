import { KeyboardHelper } from '@app/bot/helpers'
import { KEYBOARDS_CLIENT } from '@app/bot/static/keyboards'
import { TReplyMarkupKeyboard } from '@app/bot/libs'

export class ClientKeyboards {
  static mainMenu(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_CLIENT.MAIN_MENU)
  }
}
