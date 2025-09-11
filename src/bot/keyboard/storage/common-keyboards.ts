import { KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { CALLBACK_DATA, CALLBACK_PREFIX, TReplyInlineKeyboard } from '@app/bot/libs'
import { KEYBOARDS_COMMON } from '@app/bot/static/keyboards'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { UserProfileRoleEnum } from '@app/libs'

export const COMMON_BUTTONS = {
  CLOSE: {
    text: BUTTON_PATTERNS.CLOSE,
    callback_data: CALLBACK_DATA.CLOSE_MENU
  }
} as const

export class CommonKeyboards {
  static verifyActions(id: string, role: UserProfileRoleEnum): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.VERIFY,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.USER.VERIFY_YES, id, role),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.REJECT,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.USER.VERIFY_NO, id, role),
        },
        {
          text: BUTTON_PATTERNS.BLOCK,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.USER.BLOCK, id, role),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.CLOSE,
          callback_data: CALLBACK_DATA.CLOSE_MENU
        }
      ]
    ])
  }

  static registerAs() {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_COMMON.REGISTER_AS)
  }

  static consentToRules(): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.AGREE,
          callback_data: CALLBACK_PREFIX.COMMON.AGREE_TO_RULES,
        },
      ],
    ])
  }
}
