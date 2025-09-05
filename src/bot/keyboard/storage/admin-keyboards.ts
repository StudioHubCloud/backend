import { KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { KEYBOARDS_ADMIN } from '@app/bot/static/keyboards'
import { CALLBACK_PREFIX, GetTrainingByIdResponse, TReplyInlineKeyboard, TReplyMarkupKeyboard } from '@app/bot/libs'
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram'

export class AdminKeyboards {
  static mainMenu(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_ADMIN.MAIN_MENU)
  }

  static groupManageMenu(groupId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: '🤸‍♂️ Тренування',
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.GROUP.TRAININGS, groupId),
        },
      ],
      [
        {
          text: '⬅️ Назад до списку груп',
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.GROUP.BACK_TO_SELECT, groupId),
        },
      ],
    ])
  }

  static backForTrainingManage(trainingId: string, backButtonCallbackData: string | null = null): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: '⬅️ Назад до інформації про тренування',
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
      text: '🚫 Відмінити тренування',
      callback_data: RegexHelper.createButtonActionCallbackData(
        CALLBACK_PREFIX.STAFF.TRAINING.CANCEL,
        trainingId,
        backButtonCallbackData,
      ),
    }
    const makeActiveButton = {
      text: '✅ Активувати тренування',
      callback_data: RegexHelper.createButtonActionCallbackData(
        CALLBACK_PREFIX.STAFF.TRAINING.ACTIVATE,
        trainingId,
        backButtonCallbackData,
      ),
    }

    const activeSignupsButton = {
      text: '📜 Активні записи',
      callback_data: RegexHelper.createButtonActionCallbackData(
        CALLBACK_PREFIX.STAFF.TRAINING.SIGNUPS_ACTIVE,
        trainingId,
        backButtonCallbackData,
      ),
    }
    const canceledSignupsButton = {
      text: '📜 Скасовані записи',
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
          text: '✔️ Записати на тренування',
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.TRAINING.SIGN_IN,
            trainingId,
            backButtonCallbackData,
          ),
        },
      ],

      [
        {
          text: '➖ Виписати з тренування',
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.TRAINING.SIGN_OUT,
            trainingId,
            backButtonCallbackData,
          ),
        },
      ],
      [
        {
          text: '⬅️ Назад до списку тренувань',
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
          text: '📑 Переглянути деталі',
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.DETAILS, staffMemberId, 'true'),
        },
      ])
    }

    keyboard.push([{ text: '⬅️ Назад до списку тренерів', callback_data: CALLBACK_PREFIX.STAFF.PAYOUT.BACK_TO_STAFF }])

    return KeyboardHelper.createInlineKeyboard(keyboard)
  }

  static staffmemberPayoutDetailsMenu(staffMemberId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: '📝 Інформація про записи',
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.PAYOUT.CLIENT_INFO,
            staffMemberId,
            'true',
          ),
        },
      ],
      [
        {
          text: '⬅️ Назад',
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.SUMMARY, staffMemberId, 'true'),
        },
      ],
    ])
  }

  static staffmemberPayoutClientInfoMenu(staffMemberId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: '⬅️ Назад',
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.DETAILS, staffMemberId, 'true'),
        },
      ],
    ])
  }
}
