import { KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { KEYBOARDS_ADMIN } from '@app/bot/static/keyboards'
import { CALLBACK_PREFIX, GetTrainingByIdResponse, TReplyInlineKeyboard, TReplyMarkupKeyboard } from '@app/bot/libs'

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

  static backForTrainingManage(trainingId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: '⬅️ Назад до інформації про тренування',
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.TRAINING.BACK_TO_MANAGE, trainingId),
        },
      ],
    ])
  }

  static trainingManageMenu(training: GetTrainingByIdResponse): TReplyInlineKeyboard {
    const { id: trainingId, groupId, isCancelled } = training

    const cancelButton = {
      text: '🚫 Відмінити тренування',
      callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.TRAINING.CANCEL, trainingId),
    }
    const makeActiveButton = {
      text: '✅ Активувати тренування',
      callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.TRAINING.ACTIVATE, trainingId),
    }

    const activeSignupsButton = {
      text: '📜 Активні записи',
      callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.TRAINING.SIGNUPS_ACTIVE, trainingId),
    }
    const canceledSignupsButton = {
      text: '📜 Скасовані записи',
      callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.TRAINING.SIGNUPS_CANCELED, trainingId),
    }

    return KeyboardHelper.createInlineKeyboard([
      [isCancelled ? canceledSignupsButton : activeSignupsButton],
      [isCancelled ? makeActiveButton : cancelButton],
      [
        {
          text: '✔️ Записати на тренування',
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.TRAINING.SIGN_IN, trainingId),
        },
      ],

      [
        {
          text: '➖ Виписати з тренування',
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.TRAINING.SIGN_OUT, trainingId),
        },
      ],
      [
        {
          text: '⬅️ Назад до списку тренувань',
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.GROUP.BACK_TO_TRAININGS_SELECT, groupId),
        },
      ],
    ])
  }
}
