import { KeyboardHelper } from '@app/bot/helpers'
import { CALLBACK_DATA } from '@app/libs';
import { Injectable } from '@nestjs/common'
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram'

@Injectable()
export class KeyboardService {

  constructor(private readonly keyboardHelper: KeyboardHelper) {}

  removeKeyboard() {
    return this.keyboardHelper.removeReplyMarkupKeyboard()
  }

  static prepareMenuOptions<T>(
    items: T[],
    { labelKey, valueKey }: { labelKey: keyof T; valueKey: keyof T },
  ): { label: string; value: string }[] {
    return items.map((item) => {
      return {
        label: String(item[labelKey]),
        value: String(item[valueKey]),
      }
    })
  }

  createPaginatedMenu(
    data: { label: string; value: string }[],
    optons: { page?: number; perPage?: number, prefix: string },
  ): InlineKeyboardMarkup {
    const { page = 1, perPage = 6, prefix } = optons

    const totalPages = Math.ceil(data.length / perPage)
    const startIndex = (page - 1) * perPage
    const endIndex = Math.min(startIndex + perPage, data.length)

    const paginatedData = data.slice(startIndex, endIndex)

    const dataButtons = paginatedData.map(({ label, value }) => [
      { text: label, callback_data: `${prefix}:${CALLBACK_DATA.ITEM_KEY}:${value}` },
    ])
    const paginationRow = KeyboardHelper.createPaginationRow(prefix, { page, totalPages })

    return {
      inline_keyboard: [...dataButtons, ...paginationRow],
    }
  }
}
