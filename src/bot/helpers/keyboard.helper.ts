import { CALLBACK_DATA } from '@app/libs'
import { KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove } from 'telegraf/typings/core/types/typegram'

export class KeyboardHelper {
  constructor() {}

  static removeReplyMarkupKeyboard(): { reply_markup: ReplyKeyboardRemove } {
    return {
      reply_markup: {
        remove_keyboard: true,
      },
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
      callback_data: page > 1 ? `${prefix}:${CALLBACK_DATA.PAGINATION_KEY}:${page - 1}` : CALLBACK_DATA.DISABLED,
    }
    const nextButton = {
      text: '➡️',
      callback_data: page < totalPages ? `${prefix}:${CALLBACK_DATA.PAGINATION_KEY}:${page + 1}` : CALLBACK_DATA.DISABLED,
    }
    const currentPageButton = {
      text: `${page} / ${totalPages}`,
      callback_data: CALLBACK_DATA.DISABLED,
    }

    return [[prevButton, currentPageButton, nextButton]]
  }

  private static isObject(value: any): value is object {
    return typeof value === 'object' && value !== null
  }
}
