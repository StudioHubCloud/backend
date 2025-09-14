import { KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { KEYBOARDS_SCENE } from '@app/bot/static/keyboards'
import { TReplyMarkupKeyboard, TReplyInlineKeyboard, CALLBACK_PREFIX } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { GroupSelectModel, PassTemplateSelectModel } from '@app/infrastructure/database'
import { PassTemplateTypeEnum } from '@app/libs'
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram'

export class CommonSceneKeyboards {
  static exit(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_SCENE.COMMON.EXIT)
  }
  static backWithExit(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_SCENE.COMMON.BACK_EXIT)
  }

  static confirm(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_SCENE.COMMON.CONFIRM)
  }

  static dateWithSuggestion(date: string): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard([[date], ...KEYBOARDS_SCENE.COMMON.BACK_EXIT])
  }
  static selectInlineButton(prefix: string, value: string, subValue?: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.SELECT,
          callback_data: RegexHelper.createButtonActionCallbackData(prefix, value, subValue),
        },
      ],
    ])
  }
}

export class PassRelatedKeyboards {
  static passType(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_SCENE.PASS.PASS_TYPE)
  }

  static passTypeInlineKeyboard(): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.GROUP_PASS_TYPE,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.SCENES.PASS.TYPE_SELECT,
            PassTemplateTypeEnum.GROUP,
          ),
        },
      ],
      // [
      //   {
      //     text: BUTTON_PATTERNS.INDIVIDUAL_PASS_TYPE,
      //     callback_data: RegexHelper.createButtonActionCallbackData(
      //       CALLBACK_PREFIX.SCENES.PASS.TYPE_SELECT,
      //       PassTemplateTypeEnum.INDIVIDUAL,
      //     ),
      //   },
      // ],
    ])
  }

  static passTemplateSelectInlineKeyboard(passTemplateId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.SELECT,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.SCENES.PASS.TEMPLATE_SELECT, passTemplateId),
        },
      ],
      [
        {
          text: BUTTON_PATTERNS.BACK,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.SCENES.PASS.BACK_TO_LIST, passTemplateId),
        },
      ],
    ])
  }

  static passTemplatePreviewInlineKeyboard(data: PassTemplateSelectModel[]): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      ...data.map((item) => [
        {
          text: item.name,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.SCENES.PASS.TEMPLATE_DETAILS, item.id),
        },
      ]),
      [{ text: BUTTON_PATTERNS.BACK, callback_data: CALLBACK_PREFIX.SCENES.PASS.BACK_TO_TYPE_SELECT }],
    ])
  }

  static passPurchaseFileUploadInlineKeyboard(hasFiles?: boolean): TReplyInlineKeyboard {
    const buttons: InlineKeyboardButton[][] = []

    if (hasFiles) {
      buttons.push([
        {
          text: BUTTON_PATTERNS.CONFIRM,
          callback_data: CALLBACK_PREFIX.SCENES.FILE.CONFIRM,
        },
      ])

      buttons.push([
        {
          text: BUTTON_PATTERNS.DELETE,
          callback_data: CALLBACK_PREFIX.SCENES.FILE.RESET,
        },
      ])
    }

    buttons.push([
      {
        text: BUTTON_PATTERNS.BACK,
        callback_data: CALLBACK_PREFIX.SCENES.FILE.BACK,
      },
    ])

    return KeyboardHelper.createInlineKeyboard(buttons)
  }
}

export class VerifyTrainerSceneKeyboards {
  static groupSelectInlineKeyboard(groups: GroupSelectModel[]): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard(
      groups.map((group) => [
        {
          text: group.name,
          callback_data: RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.SCENES.VERIFY_TRAINER.GROUP_SELECT,
            String(group.id),
          ),
        },
      ]),
    )
  }
}

export class InitiatePayoutSceneKeyboards {
  static enterPayoutDateKeyboard(date: string): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard([[date], ...KEYBOARDS_SCENE.COMMON.EXIT])
  }

  static confirmPayoutKeyboard(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_SCENE.INITIATE_PAYOUT.CONFIRM)
  }
}
