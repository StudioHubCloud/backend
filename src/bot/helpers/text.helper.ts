import { DOB_REGEXP, NUMBERS_REGEXP } from '@app/libs/constants/regexp'

export class TextHelper {
  static stripNonNumericCharacters(text: string): string {
    return text.replace(NUMBERS_REGEXP, '');
  }

  static validateDOB(text: string): string | null {
    const regexp = DOB_REGEXP
    const isValid = regexp.test(text)
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
