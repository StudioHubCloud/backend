import { KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { KEYBOARDS_SCENE } from '@app/bot/static/keyboards'
import { TReplyMarkupKeyboard, TReplyInlineKeyboard, CALLBACK_PREFIX } from '@app/bot/libs'
import { PATTERNS_COMMON } from '@app/bot/static/patterns'
import { PassTemplateSelectModel } from '@app/infrastructure/database'

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

  static dateWithSuggestion(date: string): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard([[date], ...KEYBOARDS_SCENE.COMMON.BACK_EXIT])
  }
  static selectInlineButton(prefix: string, value: string, subValue?: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: PATTERNS_COMMON.SELECT,
          callback_data: RegexHelper.createButtonActionCallbackData(prefix, value, subValue),
        },
      ],
    ])
  }
}

export class VerifyClientSceneKeyboards {
  static passType(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_SCENE.VERIFY_CLIENT.PASS_TYPE)
  }

  static passTemplateSelectInlineKeyboard(value: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: PATTERNS_COMMON.SELECT,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.SCENES.VERIFY_CLIENT.PASS_TEMPLATE_SELECT, value),
        },
      ],
    ])
  }

  static passTemplatePreviewInlineKeyboard(data: PassTemplateSelectModel[]): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard(
      data.map((item) => [
        {
          text: item.name,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.SCENES.VERIFY_CLIENT.PASS_TEMPLATE_PREVIEW, item.id),
        },
      ]),
    )
  }
}
