import { KeyboardHelper } from '@app/bot/helpers'
import { CLIENT_KEYBOARD } from '@app/bot/static/keyboards'
import { ReplyKeyboardMarkup } from '@telegraf/types'

export class ClientKeyboards {
  static mainMenu(): { reply_markup: ReplyKeyboardMarkup } {
    return KeyboardHelper.createReplyMarkupKeyboard(CLIENT_KEYBOARD.MAIN_MENU)
  }
}
