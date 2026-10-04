import { KeyboardHelper, PersonalTrainingHelper, RegexHelper, UserHelper } from '@app/bot/helpers'
import type { IStaffPersonalSession } from '@app/bot/helpers/personal-training.helper'
import { CALLBACK_PREFIX, GetPersonalTrainingSignupListItem, TReplyInlineKeyboard } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { PersonalTrainingSignupSelectModel } from '@app/infrastructure/database'
import { InlineKeyboardButton } from '@telegraf/types'
import { COMMON_BUTTONS } from './common-keyboards'

export class PersonalTrainingKeyboards {
  /** One button per cancellable training, labelled `<date> | <trainer>`. */
  static cancelList(
    trainings: GetPersonalTrainingSignupListItem[],
    clientUserId: string,
    dateTimeProvider: DateTimeProvider,
  ): TReplyInlineKeyboard {
    const buttons: InlineKeyboardButton[][] = trainings.map((training) => {
      const date = dateTimeProvider.formatDateStringInTz(training.scheduledAt, 'dd MMMM, HH:mm')
      const trainerName = UserHelper.getDisplayName(training.staffMember?.userProfile ?? null)

      return [
        {
          text: `${date} | ${trainerName}`,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.PERSONAL_TRAINING.CANCEL_SELECT,
            training.id,
          ),
        },
      ]
    })

    buttons.push([
      {
        text: BUTTON_PATTERNS.BACK,
        callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.MANAGE, clientUserId),
      },
    ])
    buttons.push([COMMON_BUTTONS.CLOSE])

    return KeyboardHelper.createInlineKeyboard(buttons)
  }

  /** Only "✖️ Закрити", for a root message without other actions. */
  static closeOnly(): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([[COMMON_BUTTONS.CLOSE]])
  }

  /** Back to the trainer's menu in "Персонал" (admin only). */
  static staffUpcomingMenu(staffUserId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.BACK,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.BACK_TO_STAFF_MANAGE, staffUserId),
        },
      ],
      [COMMON_BUTTONS.CLOSE],
    ])
  }

  /** One button per cancellable session of a trainer (one-off or pass), labelled `<date> | <type> | <who>`. */
  static staffCancelList(
    trainings: (PersonalTrainingSignupSelectModel & IStaffPersonalSession)[],
    staffUserId: string,
    dateTimeProvider: DateTimeProvider,
  ): TReplyInlineKeyboard {
    const buttons: InlineKeyboardButton[][] = trainings.map((training) => {
      const date = dateTimeProvider.formatDateStringInTz(training.scheduledAt, 'dd MMMM, HH:mm')
      const title = PersonalTrainingHelper.getSessionTitle(training)
      const participants = PersonalTrainingHelper.getSessionParticipants(training)
      return [
        {
          text: `${date} | ${title} | ${participants}`,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.PERSONAL_TRAINING.STAFF_CANCEL_SELECT,
            training.id,
          ),
        },
      ]
    })

    buttons.push([
      {
        text: BUTTON_PATTERNS.BACK,
        callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.PAYOUT.BACK_TO_STAFF_MANAGE, staffUserId),
      },
    ])
    buttons.push([COMMON_BUTTONS.CLOSE])

    return KeyboardHelper.createInlineKeyboard(buttons)
  }

  /** Single button revealing the individual-pass memo in the client's cabinet. */
  static passRulesButton(): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.INDIVIDUAL_PASS_RULES,
          callback_data: CALLBACK_PREFIX.CLIENT.PASS_RULES,
        },
      ],
      [COMMON_BUTTONS.CLOSE], // the client's pass card is a root menu
    ])
  }
}
