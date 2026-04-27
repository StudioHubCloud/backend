import { KeyboardHelper, RegexHelper, TextHelper } from '@app/bot/helpers'
import { KEYBOARDS_ADMIN } from '@app/bot/static/keyboards'
import { CALLBACK_PREFIX, GetTrainingByIdResponse, TReplyInlineKeyboard, TReplyMarkupKeyboard } from '@app/bot/libs'
import { InlineKeyboardButton } from '@telegraf/types'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { COMMON_BUTTONS } from './common-keyboards'
import { PassActivationRequestTypeEnum, UserProfileRoleEnum } from '@app/libs'

export class AdminKeyboards {
  static mainMenu(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_ADMIN.MAIN_MENU)
  }

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
          text: BUTTON_PATTERNS.VERIFY_WITHOUT_PASS,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.USER.VERIFY_WITHOUT_PASS, id, role),
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
      [COMMON_BUTTONS.CLOSE],
    ])
  }

  static verifyPassActions(userProfileId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.CONFIRM,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.USER.PASS_PAYMENT_CONFIRM, userProfileId),
        },
        {
          text: BUTTON_PATTERNS.REJECT,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.USER.PASS_PAYMENT_REJECT, userProfileId),
        },
      ],
      [COMMON_BUTTONS.CLOSE],
    ])
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
      [COMMON_BUTTONS.CLOSE],
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
    hasSubstituteTrainer: boolean = false,
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
      [
        {
          text: hasSubstituteTrainer ? BUTTON_PATTERNS.DEASSIGN_SUBSTITUTE : BUTTON_PATTERNS.ASSIGN_SUBSTITUTE,
          callback_data: RegexHelper.createButtonActionCallbackData(
            hasSubstituteTrainer
              ? CALLBACK_PREFIX.STAFF.TRAINING.DEASSIGN_SUBSTITUTE_LIST
              : CALLBACK_PREFIX.STAFF.TRAINING.ASSIGN_SUBSTITUTE_LIST,
            trainingId,
            staffUserId ?? backButtonCallbackData,
          ),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.SCHEDULE_TO_TRAINING,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.TRAINING.SIGN_IN,
            trainingId,
            staffUserId ?? backButtonCallbackData,
          ),
        },
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
          text: BUTTON_PATTERNS.CREATE_CUSTOM_SCHEDULE_RECORD,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.TRAINING.CUSTOM_SIGN_IN,
            trainingId,
            staffUserId ?? backButtonCallbackData,
          ),
        },
      ],
      [isCancelled ? makeActiveButton : cancelButton],
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
      [COMMON_BUTTONS.CLOSE],
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

    keyboard.push([COMMON_BUTTONS.CLOSE])

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
      [COMMON_BUTTONS.CLOSE],
    ])
  }

  static clientManageMenu(clientUserId: string, isArchived: boolean): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.PASS,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.MANAGE, clientUserId),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.EDIT_PROFILE,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.CLIENT.MANAGE.PROFILE.EDIT, clientUserId),
        },
      ],
      [
        {
          text: isArchived ? BUTTON_PATTERNS.UNARCHIVE : BUTTON_PATTERNS.ARCHIVE,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.CLIENT.MANAGE[isArchived ? 'UNARCHIVE' : 'ARCHIVE'],
            clientUserId,
          ),
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
      [COMMON_BUTTONS.CLOSE],
    ])
  }

  static userProfileEditMenu(clientUserId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.EDIT_NAME,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.CLIENT.MANAGE.PROFILE.EDIT_NAME, clientUserId),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.EDIT_PHONE,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.CLIENT.MANAGE.PROFILE.EDIT_PHONE, clientUserId),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.EDIT_DATE_OF_BIRTH,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.CLIENT.MANAGE.PROFILE.EDIT_DATE_OF_BIRTH,
            clientUserId,
          ),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.BACK,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.CLIENT.MANAGE.BACK_TO_MENU, clientUserId),
        },
      ],
      [COMMON_BUTTONS.CLOSE],
    ])
  }

  static passManageMenu(clientUserId: string, isPassActivated: boolean): TReplyInlineKeyboard {
    const activateButton = !isPassActivated
      ? [
          {
            text: BUTTON_PATTERNS.ACTIVATE,
            callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.ACTIVATE, clientUserId),
          },
        ]
      : []

    return KeyboardHelper.createInlineKeyboard([
      [...activateButton],
      [
        {
          text: BUTTON_PATTERNS.PASS_ADD_NEW,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.ADD_NEW, clientUserId),
        },
      ],
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
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.CLIENT.MANAGE.BACK_TO_MENU, clientUserId),
        },
      ],
      [COMMON_BUTTONS.CLOSE],
    ])
  }
}
