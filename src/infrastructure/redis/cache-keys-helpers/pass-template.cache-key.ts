import { CACHE } from '@app/libs'

export class PassTemplateCacheKey {
  private static readonly cache_key_prefix = `${CACHE.ENTITY_KEY_PREFIX}pass-template`

  static allInStudio(studioId: string): string {
    return `${this.cache_key_prefix}:${studioId}`
  }

  static getById(id: string): string {
    return `${this.cache_key_prefix}:${id}`
  }
}
