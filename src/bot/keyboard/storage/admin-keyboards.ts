import { KeyboardHelper, RegexHelper, TextHelper } from '@app/bot/helpers'
import { KEYBOARDS_ADMIN } from '@app/bot/static/keyboards'
import { CALLBACK_PREFIX, GetTrainingByIdResponse, TReplyInlineKeyboard, TReplyMarkupKeyboard } from '@app/bot/libs'
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'

export class AdminKeyboards {
  static mainMenu(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_ADMIN.MAIN_MENU)
  }

  static groupManageMenu(groupId: number, staffUserId?: string): TReplyInlineKeyboard {

    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.TRAININGS,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.GROUP.TRAININGS, groupId, staffUserId),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.BACK_TO_GROUP_LIST,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.GROUP.BACK_TO_SELECT, groupId, staffUserId),
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

  static staffmemberPayoutSummaryMenu(userId: string, isEmpty: boolean = false): TReplyInlineKeyboard {
    const keyboard: InlineKeyboardButton[][] = []

    if (!isEmpty) {
      keyboard.push([
        {
          text: BUTTON_PATTERNS.SEE_DETAILS,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.DETAILS, userId, 'true'),
        },
      ])
      keyboard.push([
        {
          text: BUTTON_PATTERNS.INITIATE_PAYOUT,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.INITIATE, userId, 'true'),
        },
      ])
    }

    keyboard.push([{ text: BUTTON_PATTERNS.BACK, callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.BACK_TO_STAFF_MANAGE, userId, 'true') }])

    return KeyboardHelper.createInlineKeyboard(keyboard)
  }

  static staffmemberPayoutDetailsMenu(userId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.SCHEDULES_INFO,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.PAYOUT.CLIENT_INFO,
            userId,
            'true',
          ),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.BACK,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.SUMMARY, userId, 'true'),
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

  static staffmemberManageMenu(userId: string): TReplyInlineKeyboard {

    console.log(userId, 'userId in manage menu')
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.PAYOUT_CALCULATIONS,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.SUMMARY, userId, 'true'),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.STAFF_GROUPS,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.MANAGE.GROUPS_LIST, userId, 'true'),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.BACK_TO_STAFF_LIST,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.BACK_TO_STAFF_LIST, userId, 'true'),
        },
      ],
    ])
  }
}
