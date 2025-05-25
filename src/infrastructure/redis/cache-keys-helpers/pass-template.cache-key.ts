export class PassTemplateCacheKey {
  private static readonly cache_key_prefix = 'pass-template'

  static allInStudio(studioId: string): string {
    return `${this.cache_key_prefix}:${studioId}`
  }

  static getById(id: string): string {
    return `${this.cache_key_prefix}:${id}`
  }
}
