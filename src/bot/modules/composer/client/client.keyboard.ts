import { ReplyKeyboardMarkup } from '@telegraf/types'
import { CLIENT_KEYBOARD } from '@app/bot/static/keyboards'
import { KeyboardHelper } from '@app/bot/helpers'

export class ClientKeyboards {
  static mainMenu(): { reply_markup: ReplyKeyboardMarkup } {
    return KeyboardHelper.createReplyMarkupKeyboard(CLIENT_KEYBOARD.MAIN_MENU)
  }
}
