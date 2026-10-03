import { KeyboardHelper, RegexHelper, UserHelper } from '@app/bot/helpers'
import { CALLBACK_PREFIX, GetPersonalTrainingSignupListItem, TReplyInlineKeyboard } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { DateTimeProvider } from '@app/infrastructure/providers'
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

  /** Single button revealing the individual-pass memo in the client's cabinet. */
  static passRulesButton(): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.INDIVIDUAL_PASS_RULES,
          callback_data: CALLBACK_PREFIX.CLIENT.PASS_RULES,
        },
      ],
    ])
  }
}
