import { DOB_REGEXP, NUMBERS_REGEXP, PHONE_REGEXP } from '@app/libs/constants/regexp'

export class TextHelper {

  static capitalizeWord(word: string): string {
    if (!word) return word
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  }

  static stripNonNumericCharacters(text: string): string {
    return text.replace(NUMBERS_REGEXP, '')
  }

  static validateDOB(text: string): string | null {
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

  static capitalize(text?: string): string {
    if (!text) return ''
    return text.charAt(0).toUpperCase() + text.slice(1)
  }
}
