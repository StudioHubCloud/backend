import { KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { KEYBOARDS_TRAINER } from '@app/bot/static/keyboards'
import { CALLBACK_PREFIX, GetTrainingByIdResponse, TReplyInlineKeyboard, TReplyMarkupKeyboard } from '@app/bot/libs'

export class TrainerKeyboards {
  static mainMenu(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_TRAINER.MAIN_MENU)
  }

  static trainingManageMenu(training: GetTrainingByIdResponse): TReplyInlineKeyboard {
    const { id: trainingId, groupId, isCancelled } = training

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
      [
        {
          text: '⬅️ Назад до списку тренувань',
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.GROUP.BACK_TO_TRAININGS_SELECT, groupId),
        },
      ],
    ])
  }
}
