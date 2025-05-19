export class MessageHelper {
  static getAgeRestrictionMessage(minAge: number | null = null, maxAge: number | null = null): string {
    const minAgeText = minAge ? `від ${minAge} років` : ''
    const maxAgeText = maxAge ? ` до ${maxAge} років` : ''
    return `📢 Увага!\n\n💖 Для цієї групи є вікові обмеження:${minAgeText}${maxAgeText}`
  }
}
