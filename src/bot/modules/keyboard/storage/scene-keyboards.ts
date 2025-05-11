import { KeyboardHelper } from '@app/bot/helpers';
import { KEYBOARDS_SCENE } from '@app/bot/static/keyboards';
import { TReplyMarkupKeyboard } from '@app/libs';

export class CommonSceneKeyboards {
  static exit(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_SCENE.COMMON.EXIT)
  }
  static backWithExit(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_SCENE.COMMON.BACK_EXIT)
  }

  static confirm(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_SCENE.COMMON.CONFIRM)
  }
}