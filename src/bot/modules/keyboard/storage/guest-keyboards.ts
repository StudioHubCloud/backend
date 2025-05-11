import { KeyboardHelper } from '@app/bot/helpers'
import { KEYBOARDS_GUEST } from '@app/bot/static/keyboards'
import { TReplyMarkupKeyboard } from '@app/libs'

export class GuestKeyboards {
  static mainMenu(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_GUEST.MAIN_MENU)
  }
  static registerAsGuest(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_GUEST.REGISTER_AS_GUEST)
  }
}