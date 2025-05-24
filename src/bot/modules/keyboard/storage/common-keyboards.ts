import { KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { CALLBACK_PREFIX, TReplyInlineKeyboard } from '@app/bot/libs'
import { KEYBARODS_COMMON } from '@app/bot/static/keyboards'
import { PATTERNS_COMMON } from '@app/bot/static/patterns'
import { UserProfileRoleEnum } from '@app/libs'

export class CommonKeyboards {
  static verifyActions(id: string, role: UserProfileRoleEnum): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: PATTERNS_COMMON.VERIFY,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.VERIFY_USER, id, role),
        },
      ],
      [
        {
          text: PATTERNS_COMMON.REJECT,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.REJECT_USER_VERIFY, id, role),
        },
        {
          text: PATTERNS_COMMON.BLOCK,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.BLOCK_USER, id, role),
        },
      ],
    ])
  }

  static registerAs() {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBARODS_COMMON.REGISTER_AS)
  }
}
