import { CALLBACK_DATA } from '@app/libs'
import { Injectable } from '@nestjs/common'
import {
  InlineKeyboardMarkup,
  KeyboardButton,
  ReplyKeyboardMarkup,
  ReplyKeyboardRemove,
} from 'telegraf/typings/core/types/typegram'

@Injectable()
export class KeyboardHelper {
  constructor() {}

  removeReplyMarkupKeyboard(): { reply_markup: ReplyKeyboardRemove } {
    return {
      reply_markup: {
        remove_keyboard: true,
      },
    }
  }

  createReplyMarkupKeyboard(buttons: string[][]) {
    return {
      reply_markup: {
        keyboard: buttons.map((row) => row.map((button) => ({ text: button }))),
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  }

  static genericInlineKeyboard(items: string[], callbackDataPrefix: string): InlineKeyboardMarkup {
    const buttons = items.map((item) => [{ text: item, callback_data: `${callbackDataPrefix}:${item}` }])
    return {
      inline_keyboard: buttons,
    }
  }

  static createInlineKeyboard(buttons: { text: string; callback_data: string }[][]): InlineKeyboardMarkup {
    return {
      inline_keyboard: buttons,
    }
  }

  static createReplyMarkupKeyboard(
    buttons: string[][],
    options: Partial<KeyboardButton> = {},
    extras: Omit<ReplyKeyboardMarkup, 'keyboard'> = {},
  ): ReplyKeyboardMarkup {
    const { resize_keyboard = true, one_time_keyboard = false } = extras
    return {
      keyboard: buttons.map((row) => row.map((button) => ({ text: button, ...(KeyboardHelper.isObject(options) ? options : {}) }))),
      resize_keyboard: resize_keyboard,
      one_time_keyboard: one_time_keyboard,
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
      callback_data:
        page < totalPages ? `${prefix}:${CALLBACK_DATA.PAGINATION_KEY}:${page + 1}` : CALLBACK_DATA.DISABLED,
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
