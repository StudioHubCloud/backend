import { KeyboardHelper, RegexHelper, TextHelper } from '@app/bot/helpers'
import { KEYBOARDS_ADMIN } from '@app/bot/static/keyboards'
import { CALLBACK_DATA, CALLBACK_PREFIX, GetTrainingByIdResponse, TReplyInlineKeyboard, TReplyMarkupKeyboard } from '@app/bot/libs'
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
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.GROUP.BACK_TO_SELECT,
            groupId,
            staffUserId,
          ),
        },
      ],
    ])
  }

  static backForTrainingManage(
    trainingId: string,
    backButtonCallbackData: string | null = null,
    staffUserId?: string | null,
  ): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.BACK,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.TRAINING.BACK_TO_MANAGE,
            trainingId,
            staffUserId ?? backButtonCallbackData,
          ),
        },
      ],
    ])
  }

  static trainingManageMenu(
    training: GetTrainingByIdResponse,
    backButtonCallbackData?: string | null,
    staffUserId?: string,
  ): TReplyInlineKeyboard {
    const { id: trainingId, groupId, isCancelled } = training

    const cancelButton = {
      text: BUTTON_PATTERNS.CANCEL_TRAINING,
      callback_data: RegexHelper.createButtonActionCallbackData(
        CALLBACK_PREFIX.STAFF.TRAINING.CANCEL,
        trainingId,
        staffUserId ?? backButtonCallbackData,
      ),
    }
    const makeActiveButton = {
      text: BUTTON_PATTERNS.ACTIVATE_TRAINING,
      callback_data: RegexHelper.createButtonActionCallbackData(
        CALLBACK_PREFIX.STAFF.TRAINING.ACTIVATE,
        trainingId,
        staffUserId ?? backButtonCallbackData,
      ),
    }

    const activeSignupsButton = {
      text: BUTTON_PATTERNS.ACTIVE_SCHEDULES_LIST,
      callback_data: RegexHelper.createButtonActionCallbackData(
        CALLBACK_PREFIX.STAFF.TRAINING.SIGNUPS_ACTIVE,
        trainingId,
        staffUserId ?? backButtonCallbackData,
      ),
    }
    const canceledSignupsButton = {
      text: BUTTON_PATTERNS.CANCELED_SCHEDULES_LIST,
      callback_data: RegexHelper.createButtonActionCallbackData(
        CALLBACK_PREFIX.STAFF.TRAINING.SIGNUPS_CANCELED,
        trainingId,
        staffUserId ?? backButtonCallbackData,
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
            staffUserId ?? backButtonCallbackData,
          ),
        },
      ],

      [
        {
          text: BUTTON_PATTERNS.DESCHEDULE_FROM_TRAINING,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.TRAINING.SIGN_OUT,
            trainingId,
            staffUserId ?? backButtonCallbackData,
          ),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.BACK_TO_TRAINING_LIST,
          callback_data: RegexHelper.createButtonActionCallbackData(
            backButtonCallbackData ?? CALLBACK_PREFIX.STAFF.GROUP.BACK_TO_TRAININGS_SELECT,
            groupId,
            staffUserId,
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

    keyboard.push([
      {
        text: BUTTON_PATTERNS.BACK,
        callback_data: RegexHelper.createButtonActionCallbackData(
          CALLBACK_PREFIX.STAFF.PAYOUT.BACK_TO_STAFF_MANAGE,
          userId,
          'true',
        ),
      },
    ])

    return KeyboardHelper.createInlineKeyboard(keyboard)
  }

  static staffmemberPayoutDetailsMenu(userId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.SCHEDULES_INFO,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.CLIENT_INFO, userId, 'true'),
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
          text: BUTTON_PATTERNS.ADD_GROUP_TO_STAFF,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.MANAGE.ADD_GROUP, userId, 'true'),
        },
        {
          text: BUTTON_PATTERNS.REMOVE_GROUP_FROM_STAFF, // <- дублікат
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.MANAGE.REMOVE_GROUP, userId, 'true'),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.BACK_TO_STAFF_LIST,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.PAYOUT.BACK_TO_STAFF_LIST,
            userId,
            'true',
          ),
        },
      ],
    ])
  }

  static clientManageMenu(clientUserId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.PASS,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.MANAGE, clientUserId),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.BACK,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.CLIENT.MANAGE.BACK_TO_CLIENT_LIST,
            clientUserId,
          ),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.CLOSE,
          callback_data: CALLBACK_DATA.CLOSE_MENU,
        },
      ],
    ])
  }

  static passManageMenu(clientUserId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.PASS_EDIT_LENGTH,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.EDIT_LENGTH, clientUserId),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.PASS_EDIT_START_DATE,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.CLIENT.MANAGE.PASS.EDIT_START_DATE,
            clientUserId,
          ),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.PASS_EDIT_END_DATE,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.EDIT_END_DATE, clientUserId),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.BACK,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.CLIENT.MANAGE.BACK_TO_CLIENT_LIST,
            clientUserId,
          ),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.CLOSE,
          callback_data: CALLBACK_DATA.CLOSE_MENU,
        },
      ],
    ])
  }
}
