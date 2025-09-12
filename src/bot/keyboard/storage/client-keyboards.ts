import { KeyboardHelper } from '@app/bot/helpers'
import { KEYBOARDS_CLIENT } from '@app/bot/static/keyboards'
import { TReplyMarkupKeyboard } from '@app/bot/libs'

export class ClientKeyboards {
  static mainMenu({ withoutPass }: { withoutPass: boolean } = { withoutPass: false }): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(
      withoutPass ? KEYBOARDS_CLIENT.MAIN_MENU_WITHOUT_PASS : KEYBOARDS_CLIENT.MAIN_MENU,
    )
  }
}
