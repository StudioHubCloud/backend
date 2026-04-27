import { KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { KEYBOARDS_TRAINER } from '@app/bot/static/keyboards'
import { CALLBACK_PREFIX, GetTrainingByIdResponse, TReplyInlineKeyboard, TReplyMarkupKeyboard } from '@app/bot/libs'
import { InlineKeyboardButton } from '@telegraf/types'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'

export class TrainerKeyboards {
  static mainMenu(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_TRAINER.MAIN_MENU)
  }

  static trainingManageMenu(training: GetTrainingByIdResponse, backButtonCallbackData?: string | null): TReplyInlineKeyboard {
    const { id: trainingId, groupId, isCancelled } = training

    const activeSignupsButton = {
      text: BUTTON_PATTERNS.ACTIVE_SCHEDULES_LIST,
      callback_data: RegexHelper.createButtonActionCallbackData(
        CALLBACK_PREFIX.STAFF.TRAINING.SIGNUPS_ACTIVE,
        trainingId,
        backButtonCallbackData,
      ),
    }
    const canceledSignupsButton = {
      text: BUTTON_PATTERNS.CANCELED_SCHEDULES_LIST,
      callback_data: RegexHelper.createButtonActionCallbackData(
        CALLBACK_PREFIX.STAFF.TRAINING.SIGNUPS_CANCELED,
        trainingId,
        backButtonCallbackData,
      ),
    }

    return KeyboardHelper.createInlineKeyboard([
      [isCancelled ? canceledSignupsButton : activeSignupsButton],
      [
        {
          text: BUTTON_PATTERNS.BACK_TO_TRAINING_LIST,
          callback_data: RegexHelper.createButtonActionCallbackData(
            backButtonCallbackData ?? CALLBACK_PREFIX.STAFF.GROUP.BACK_TO_TRAININGS_SELECT,
            groupId,
          ),
        },
      ],
    ])
  }

  static staffmemberPayoutSummaryMenu(staffMemberId: string, isEmpty: boolean = false): TReplyInlineKeyboard {
    const keyboard: InlineKeyboardButton[][] = []

    if (!isEmpty) {
      keyboard.push([
        {
          text: BUTTON_PATTERNS.SEE_DETAILS,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.DETAILS, staffMemberId),
        },
      ])
    }
    return KeyboardHelper.createInlineKeyboard(keyboard)
  }

  static staffmemberPayoutDetailsMenu(staffMemberId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.SCHEDULES_INFO,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.CLIENT_INFO, staffMemberId),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.BACK,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.SUMMARY, staffMemberId),
        },
      ],
    ])
  }

  static staffmemberPayoutClientInfoMenu(staffMemberId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.BACK,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.DETAILS, staffMemberId),
        },
      ],
    ])
  }
}
