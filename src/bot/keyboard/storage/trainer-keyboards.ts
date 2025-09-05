import { KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { KEYBOARDS_TRAINER } from '@app/bot/static/keyboards'
import { CALLBACK_PREFIX, GetTrainingByIdResponse, TReplyInlineKeyboard, TReplyMarkupKeyboard } from '@app/bot/libs'
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram'

export class TrainerKeyboards {
  static mainMenu(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_TRAINER.MAIN_MENU)
  }

  static trainingManageMenu(training: GetTrainingByIdResponse, backButtonCallbackData?: string | null): TReplyInlineKeyboard {
    const { id: trainingId, groupId, isCancelled } = training

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

  static staffmemberPayoutSummaryMenu(staffMemberId: string, isEmpty: boolean = false): TReplyInlineKeyboard {
    const keyboard: InlineKeyboardButton[][] = []

    if (!isEmpty) {
      keyboard.push([
        {
          text: '📑 Переглянути деталі',
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.DETAILS, staffMemberId, 'true'),
        },
      ])
    }
    return KeyboardHelper.createInlineKeyboard(keyboard)
  }

  static staffmemberPayoutDetailsMenu(staffMemberId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: '📝 Інформація про записи',
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.CLIENT_INFO, staffMemberId),
        },
      ],
      [
        {
          text: '⬅️ Назад',
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.SUMMARY, staffMemberId),
        },
      ],
    ])
  }

  static staffmemberPayoutClientInfoMenu(staffMemberId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: '⬅️ Назад',
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.DETAILS, staffMemberId),
        },
      ],
    ])
  }
}
