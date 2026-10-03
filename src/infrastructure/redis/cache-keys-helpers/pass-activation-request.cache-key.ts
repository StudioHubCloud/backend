import { CACHE } from '@app/libs'

export class PassActivationRequestCacheKey {
  private static readonly cache_key_prefix = `${CACHE.ENTITY_KEY_PREFIX}passActivationRequest`

  static getById(id: string): string {
    return `${this.cache_key_prefix}:id:${id}`
  }

  static studioRequests(studioId: string): string {
    return `${this.cache_key_prefix}:studioId:${studioId}`
  }
}
