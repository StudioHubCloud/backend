import { TextHelper } from './text.helper'

export class NameHelper {

  private static readonly COMMON_FEMALE_FIRST_NAMES = [
    // Classic Ukrainian names
    'анастасія', 'марія', 'олена', 'катерина', 'наталія', 'ірина', 'оксана', 'юлія', 'тетяна', 'світлана',
    'вікторія', 'алла', 'людмила', 'ольга', 'валентина', 'галина', 'ліна', 'діана', 'анна', 'дар\'я',
    'єлизавета', 'софія', 'александра', 'віра', 'надія', 'любов', 'христина', 'валерія', 'алєна', 'інна',
    'лариса', 'тамара', 'євгенія', 'ліля', 'зоя', 'ніна', 'роксолана', 'аліна', 'карина', 'поліна',
    
    // Modern popular names
    'аліса', 'арина', 'вероніка', 'дарина', 'емілія', 'есмеральда', 'жанна', 'злата', 'кіра', 'лілія',
    'маргарита', 'мілана', 'ніколь', 'олівія', 'паоліна', 'регіна', 'стефанія', 'ульяна', 'фаїна', 'ясміна',
    
    // Traditional Ukrainian names
    'богдана', 'василина', 'гаяна', 'дана', 'єва', 'жасмін', 'зореслава', 'іванна', 'калина', 'лада',
    'мирослава', 'неоніла', 'орислава', 'пр\'ясконя', 'радмила', 'слава', 'творимира', 'уляна', 'фемида', 'христя',
    
    // International names popular in Ukraine
    'аделіна', 'белла', 'валерія', 'габріела', 'даніела', 'ева', 'флора', 'грета', 'ханна', 'ізабелла',
    'ясна', 'камілла', 'лейла', 'маріанна', 'ніна', 'олександра', 'паула', 'ребека', 'сабріна', 'тіна',
    
    // Diminutive forms and nicknames often used officially
    'оля', 'катя', 'настя', 'таня', 'ліза', 'саша', 'марічка', 'наташа', 'ксенія', 'женя',
    'аня', 'соня', 'ліна', 'віка', 'даша', 'маша', 'ніка', 'рита', 'альона', 'леся',
    
    // Names with apostrophes and special characters
    'ар\'янна', 'дзвінка', 'мар\'яна', 'дар\'я', 'тар\'яна', 'лар\'я', 'ор\'янна', 'тер\'янна',
    
    // Regional variations
    'галя', 'стася', 'божена', 'мілена', 'зірка', 'оряна', 'злата', 'сніжана', 'весна', 'осінь',
    'христя', 'параска', 'меланка', 'марта', 'дарка', 'ганна', 'степанія', 'устина', 'феодосія', 'юстина',
    
    // Contemporary trendy names
    'міла', 'ема', 'зоя', 'ай', 'лея', 'міа', 'тея', 'нора', 'ілона', 'єлена',
    'амелія', 'барбара', 'селена', 'телма', 'ванеса', 'глорія', 'моніка', 'патриція', 'сандра', 'терезія'
  ]

  // Ukrainian surname endings (female forms only)
  private static readonly SURNAME_ENDINGS = [
    'ська', 'цька', 'енко', 'ник', 'юк', 'чук', 'шенко', 'ева', 'ова', 'ина', 'ич', 'ук', 'ко', 'на',
    'іна', 'ецька', 'ович', 'евич', 'ака', 'яка', 'ченко', 'денко', 'ась', 'ось', 'усь', 'ись'
  ]

  static isCommonFirstName(word: string): boolean {
    if (!word) return false
    const lowerWord = word.toLowerCase()
    return this.COMMON_FEMALE_FIRST_NAMES.includes(lowerWord)
  }

  static isLikelySurname(word: string): boolean {
    if (!word || word.length < 2) return false
    
    const lowerWord = word.toLowerCase()
    return this.SURNAME_ENDINGS.some(ending => lowerWord.endsWith(ending))
  }

  /**
   * Calculates confidence score for name order (higher = more confident it's first name, last name)
   */
  static calculateNameOrderConfidence(firstWord: string, secondWord: string): number {
    let score = 0
    
    if (this.isCommonFirstName(firstWord)) score += 3
    if (this.isCommonFirstName(secondWord)) score -= 3
    if (this.isLikelySurname(firstWord)) score -= 2
    if (this.isLikelySurname(secondWord)) score += 2
    
    return score
  }

  /**
   * Processes name input and returns {firstName, lastName} in correct order
   */
  static processNameInput(input: string): { 
    firstName: string; 
    lastName?: string; 
    wasSwapped?: boolean;
    confidence?: 'high' | 'medium' | 'low'
  } {
    if (!input?.trim()) {
      return { firstName: '' }
    }

    const words = input.trim().split(/\s+/).filter(word => word.length > 0)
    
    if (words.length === 1) {
      return { firstName: TextHelper.capitalizeWord(words[0]) }
    }

    if (words.length === 2) {
      const [firstWord, secondWord] = words
      const confidence = this.calculateNameOrderConfidence(firstWord, secondWord)
      
      // If confidence is strongly negative, swap the names
      if (confidence <= -3) {
        return {
          firstName: TextHelper.capitalizeWord(secondWord),
          lastName: TextHelper.capitalizeWord(firstWord),
          wasSwapped: true,
          confidence: 'high'
        }
      }
      
      // If confidence is moderately negative, suggest swap
      if (confidence < -1) {
        return {
          firstName: TextHelper.capitalizeWord(firstWord),
          lastName: TextHelper.capitalizeWord(secondWord),
          wasSwapped: false,
          confidence: 'low'
        }
      }
      
      // Normal order
      return {
        firstName: TextHelper.capitalizeWord(firstWord),
        lastName: TextHelper.capitalizeWord(secondWord),
        wasSwapped: false,
        confidence: confidence > 1 ? 'high' : 'medium'
      }
    }

    // For 3+ words, strip any extra words and process first two
    const nameWithOnlyTwoWords = words.slice(0, 2)
    return this.processNameInput(nameWithOnlyTwoWords.join(' '))
  }

  static validateNames(firstName: string, lastName?: string): { isValid: boolean; suggestion?: string } {
    if (!firstName || firstName.length < 2) {
      return { isValid: false, suggestion: "Ім'я повинно містити мінімум 2 символи" }
    }

    if (lastName && lastName.length < 2) {
      return { isValid: false, suggestion: "Прізвище повинно містити мінімум 2 символи" }
    }

    return { isValid: true }
  }

  /**
   * Gets suggestion message based on confidence and swap status
   */
  static getSuggestionMessage(result: ReturnType<typeof NameHelper.processNameInput>): string | null {
    if (result.confidence === 'low' && !result.wasSwapped && result.lastName) {
      return `Можливо ви мали на увазі: ${result.lastName} ${result.firstName}?`
    }
    
    if (result.wasSwapped) {
      return `Автоматично виправлено порядок імені та прізвища.`
    }
    
    return null
  }

}