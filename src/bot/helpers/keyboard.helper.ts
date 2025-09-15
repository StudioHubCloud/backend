import {
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  KeyboardButton,
  ReplyKeyboardMarkup,
  ReplyKeyboardRemove,
} from '@telegraf/types'
import { AutocompletableString, UserProfileRoleEnum } from '@app/libs'
import { CALLBACK_DATA, TNormalizedOption, TPaginatedMenuOptions, TReplyInlineKeyboard } from '@app/bot/libs'
import { AdminKeyboards, ClientKeyboards, GuestKeyboards, MaintainerKeyboards, TrainerKeyboards } from '../keyboard/storage'
import { BUTTON_PATTERNS } from '../static/button-patterns'

export class KeyboardHelper {
  constructor() {}

  static removeReplyMarkupKeyboard(): { reply_markup: ReplyKeyboardRemove } {
    return {
      reply_markup: {
        remove_keyboard: true,
      },
    }
  }

  static createInlineKeyboard(buttons: InlineKeyboardButton[][]): TReplyInlineKeyboard {
    return {
      reply_markup: {
        inline_keyboard: buttons,
      },
    }
  }

  static createPaginatedMenu(data: TNormalizedOption[], optons: TPaginatedMenuOptions): InlineKeyboardMarkup {
    const { page = 1, perPage = 6, prefix } = optons

    const totalPages = Math.ceil(data.length / perPage)
    const startIndex = (page - 1) * perPage
    const endIndex = Math.min(startIndex + perPage, data.length)

    const paginatedData = data.slice(startIndex, endIndex)

    const dataButtons = paginatedData.map(({ label, value }) => [
      { text: label, callback_data: `${prefix}:${CALLBACK_DATA.ITEM_KEY}:${value}` },
    ])
    const paginationRow = data.length > perPage ? this.createPaginationRow(prefix, { page, totalPages }) : []

    return {
      inline_keyboard: [...dataButtons, ...paginationRow],
    }
  }

  static createReplyMarkupKeyboard(
    buttons: string[][],
    options: Partial<KeyboardButton> = {},
    extras: Omit<ReplyKeyboardMarkup, 'keyboard'> = {},
  ): { reply_markup: ReplyKeyboardMarkup } {
    const { resize_keyboard = true, one_time_keyboard = false } = extras
    return {
      reply_markup: {
        keyboard: buttons.map((row) =>
          row.map((button) => ({ text: button, ...(KeyboardHelper.isObject(options) ? options : {}) })),
        ),
        resize_keyboard: resize_keyboard,
        one_time_keyboard: one_time_keyboard,
      },
    }
  }

  static createPaginationRow(
    prefix: string,
    options: { page: number; totalPages: number },
  ): { text: string; callback_data: string }[][] {
    const { page, totalPages } = options
    const prevButton = {
      text: '⬅️',
      callback_data: page > 1 ? `${prefix}:${CALLBACK_DATA.PAGINATION_KEY}:${page - 1}` : CALLBACK_DATA.DISABLED, //potentialy refactor this to use a function
    }
    const nextButton = {
      text: '➡️',
      callback_data: page < totalPages ? `${prefix}:${CALLBACK_DATA.PAGINATION_KEY}:${page + 1}` : CALLBACK_DATA.DISABLED, //potentialy refactor this to use a function
    }
    const currentPageButton = {
      text: `${page} / ${totalPages}`,
      callback_data: CALLBACK_DATA.DISABLED,
    }

    return [[prevButton, currentPageButton, nextButton]]
  }

  static prepareInlineMenuOptions<T extends Record<string, any>>(
    items: T[],
    {
      labelKey,
      valueKey,
      emoji,
    }: {
      labelKey: keyof T | (keyof T)[] | AutocompletableString
      valueKey: keyof T
      emoji?: string | string[]
    },
  ): TNormalizedOption[] {
    return items.map((item) => {
      let emojiPrefix = ''

      if (emoji) {
        if (typeof emoji === 'string') {
          emojiPrefix = `${emoji} `
        } else {
          let current: Record<string, any> | null = item
          for (const key of emoji) {
            if (current && typeof current === 'object' && key in current) {
              current = current[key]
            } else {
              current = null
              break
            }
          }
          if (typeof current === 'string') {
            emojiPrefix = `${current} `
          }
        }
      }

      let labelPart: string

      if (Array.isArray(labelKey)) {
        labelPart = labelKey.map((key) => String(item[key])).join(' ')
      } else {
        labelPart = String(item[labelKey as keyof T])
      }

      const label = emojiPrefix + labelPart

      return {
        label,
        value: String(item[valueKey]),
      }
    })
  }

  static getRoleBasedMainMenuKeyboard(role: UserProfileRoleEnum, { withoutPass = false }: { withoutPass?: boolean } = {}) {
    const KeyboardsMap = {
      [UserProfileRoleEnum.CLIENT]: ClientKeyboards.mainMenu({ withoutPass }),
      [UserProfileRoleEnum.GUEST]: GuestKeyboards.mainMenu(),
      [UserProfileRoleEnum.TRAINER]: TrainerKeyboards.mainMenu(),
      [UserProfileRoleEnum.ADMIN]: AdminKeyboards.mainMenu(),
      [UserProfileRoleEnum.MAINTAINER]: MaintainerKeyboards.mainMenu(),
    }
    return KeyboardsMap[role]
  }

  private static isObject(value: any): value is object {
    return typeof value === 'object' && value !== null
  }

  static addCloseButton(keyboard: TReplyInlineKeyboard): TReplyInlineKeyboard {
    const newButtons = [
      ...keyboard.reply_markup.inline_keyboard,
      [{ text: BUTTON_PATTERNS.CLOSE, callback_data: CALLBACK_DATA.CLOSE_MENU }],
    ]

    return {
      reply_markup: {
        inline_keyboard: newButtons,
      },
    }
  }
}
