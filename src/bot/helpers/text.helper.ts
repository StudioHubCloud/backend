import { DOB_REGEXP, NUMBERS_REGEXP, PHONE_REGEXP } from '@app/libs/constants/regexp'

export class TextHelper {
  static capitalizeWord(word: string): string {
    if (!word) return word
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  }

  static stripNonNumericCharacters(text: string): string {
    return text.replace(NUMBERS_REGEXP, '')
  }

  static validateDateInput(text: string): string | null {
    const match = DOB_REGEXP.exec(text)
    if (!match) {
      return null
    }
    const [_, day, month, year1] = match
    return `${day}.${month}.${year1}`
  }

  static validatePhone(text: string): string | null {
    const isValid = PHONE_REGEXP.test(text)
    if (!isValid) {
      return null
    }
    return text
  }

  static bold(text?: string | number): string {
    return text ? `<b>${text}</b>` : ''
  }

  static italic(text?: string): string {
    return text ? `<i>${text}</i>` : ''
  }

  static underscore(text?: string): string {
    return text ? `<u>${text}</u>` : ''
  }

  static strikethrough(text?: string): string {
    return text ? `<s>${text}</s>` : ''
  }

  static capitalize(text?: string): string {
    if (!text) return ''
    return text.charAt(0).toUpperCase() + text.slice(1)
  }

  static encodeUuid(uuid?: string) {
    if (!uuid) return ''

    // Remove dashes and convert hex to base64
    const hex = uuid.replace(/-/g, '')
    return Buffer.from(hex, 'hex').toString('base64')
  }

  static telLink(phoneNumber: string, modifier: 'bold'): string {
    const sanitizedNumber = phoneNumber.replace(/\D/g, '')
    return `<a href="tel:${sanitizedNumber}">${modifier === 'bold' ? TextHelper.bold(sanitizedNumber) : sanitizedNumber}</a>`
  }

  static decodeUuid(encoded?: string) {
    if (!encoded) return ''
    const hex = Buffer.from(encoded, 'base64').toString('hex')
    // Reconstruct UUID format: 8-4-4-4-12
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
  }
}
