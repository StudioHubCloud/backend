import { KeyboardHelper } from '@app/bot/helpers';
import { KEYBOARDS_CLIENT } from '@app/bot/static/keyboards';
import { TReplyMarkupKeyboard } from '@app/libs';

export class ClientKeyboards {
  static mainMenu(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_CLIENT.MAIN_MENU)
  }

  static registerAsClient(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_CLIENT.REGISTER_AS_CLIENT)
  }
}