import { DOB_REGEXP, NUMBERS_REGEXP, PHONE_REGEXP } from '@app/libs/constants/regexp'

export class TextHelper {
  static stripNonNumericCharacters(text: string): string {
    return text.replace(NUMBERS_REGEXP, '')
  }

  static validateDOB(text: string): string | null {
    const match = DOB_REGEXP.exec(text)
    if (!match) {
      return null
    }
    const [_, day, month, year1, year2] = match
    console.log(year2, 'year2')
    return `${day}.${month}.${year1}`
  }

  static validatePhone(text: string): string | null {
    const isValid = PHONE_REGEXP.test(text)
    if (!isValid) {
      return null
    }
    return text
  }

  static bold(text?: string): string {
    return text ? `<b>${text}</b>` : ''
  }

  static italic(text?: string): string {
    return text ? `<i>${text}</i>` : ''
  }
}
