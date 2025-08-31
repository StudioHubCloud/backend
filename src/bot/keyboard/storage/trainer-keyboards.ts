import { KeyboardHelper } from '@app/bot/helpers'
import { KEYBOARDS_TRAINER } from '@app/bot/static/keyboards'
import { TReplyMarkupKeyboard } from '@app/bot/libs'

export class TrainerKeyboards {
  static mainMenu(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_TRAINER.MAIN_MENU)
  }
}
