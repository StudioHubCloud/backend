import { CALLBACK_DATA } from '@app/bot/libs'

export class RegexHelper {
  static createSimpleRegex(prefix: string) {
    return new RegExp(`^${prefix}$`) 
  }

  static createMenuPaginationActionRegex(prefix: string) {
    return new RegExp(`^${prefix}:${CALLBACK_DATA.PAGINATION_KEY}:(.*)$`) //add named groups
  }

  static createMenuSelectItemRegex(prefix: string) {
    return new RegExp(`^${prefix}:${CALLBACK_DATA.ITEM_KEY}:(.*)$`) // add named groups
  }

  static createButtonActionRegex(prefix: string) {
    return new RegExp(`^${prefix}:(?<value>[^:]+)(?::(?<subvalue>.*))?$`)
  }

  static createButtonActionCallbackData(prefix: string, value: string, subvalue?: string) {
    return `${prefix}:${value}${subvalue ? `:${subvalue}` : ''}`
  }

  static getMatchValue(input: RegExp | string, data: string) {
    const regex = typeof input === 'string' ? this.createButtonActionRegex(input) : input
    const match = data.match(regex)
    return match ? [match[1], match[2]] : null
  }
}
