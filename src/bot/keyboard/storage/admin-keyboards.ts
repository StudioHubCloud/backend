import { KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { KEYBOARDS_ADMIN } from '@app/bot/static/keyboards'
import { CALLBACK_PREFIX, GetTrainingByIdResponse, TReplyInlineKeyboard, TReplyMarkupKeyboard } from '@app/bot/libs'
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'

export class AdminKeyboards {
  static mainMenu(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_ADMIN.MAIN_MENU)
  }

  static groupManageMenu(groupId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.TRAININGS,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.GROUP.TRAININGS, groupId),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.BACK_TO_GROUP_LIST,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.GROUP.BACK_TO_SELECT, groupId),
        },
      ],
    ])
  }

  static backForTrainingManage(trainingId: string, backButtonCallbackData: string | null = null): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.BACK_TO_TRAINING_INFO,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.TRAINING.BACK_TO_MANAGE,
            trainingId,
            backButtonCallbackData,
          ),
        },
      ],
    ])
  }

  static trainingManageMenu(training: GetTrainingByIdResponse, backButtonCallbackData?: string | null): TReplyInlineKeyboard {
    const { id: trainingId, groupId, isCancelled } = training

    const cancelButton = {
      text: BUTTON_PATTERNS.CANCEL_TRAINING,
      callback_data: RegexHelper.createButtonActionCallbackData(
        CALLBACK_PREFIX.STAFF.TRAINING.CANCEL,
        trainingId,
        backButtonCallbackData,
      ),
    }
    const makeActiveButton = {
      text: BUTTON_PATTERNS.ACTIVATE_TRAINING,
      callback_data: RegexHelper.createButtonActionCallbackData(
        CALLBACK_PREFIX.STAFF.TRAINING.ACTIVATE,
        trainingId,
        backButtonCallbackData,
      ),
    }

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
      [isCancelled ? makeActiveButton : cancelButton],
      [
        {
          text: BUTTON_PATTERNS.SCHEDULE_TO_TRAINING,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.TRAINING.SIGN_IN,
            trainingId,
            backButtonCallbackData,
          ),
        },
      ],

      [
        {
          text: BUTTON_PATTERNS.DESCHEDULE_FROM_TRAINING,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.TRAINING.SIGN_OUT,
            trainingId,
            backButtonCallbackData,
          ),
        },
      ],
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

  static staffmemberPayoutInfoMenu(staffMemberId: string, isEmpty: boolean = false): TReplyInlineKeyboard {
    const keyboard: InlineKeyboardButton[][] = []

    if (!isEmpty) {
      keyboard.push([
        {
          text: BUTTON_PATTERNS.SEE_DETAILS,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.DETAILS, staffMemberId, 'true'),
        },
      ])
    }

    keyboard.push([{ text: BUTTON_PATTERNS.BACK_TO_STAFF_LIST, callback_data: CALLBACK_PREFIX.STAFF.PAYOUT.BACK_TO_STAFF }])

    return KeyboardHelper.createInlineKeyboard(keyboard)
  }

  static staffmemberPayoutDetailsMenu(staffMemberId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.SCHEDULES_INFO,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.PAYOUT.CLIENT_INFO,
            staffMemberId,
            'true',
          ),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.BACK,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.SUMMARY, staffMemberId, 'true'),
        },
      ],
    ])
  }

  static staffmemberPayoutClientInfoMenu(staffMemberId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.BACK,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.DETAILS, staffMemberId, 'true'),
        },
      ],
    ])
  }
}
