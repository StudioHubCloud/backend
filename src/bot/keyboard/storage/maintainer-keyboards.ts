import { KeyboardHelper } from '@app/bot/helpers'
import { KEYBOARDS_MAINTAINER } from '@app/bot/static/keyboards'
import { TReplyMarkupKeyboard } from '@app/bot/libs'

export class MaintainerKeyboards {
  static mainMenu(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_MAINTAINER.MAIN_MENU)
  }

  static configureBotMenu(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_MAINTAINER.CONFIGURE_BOT_MENU)
  }
}
