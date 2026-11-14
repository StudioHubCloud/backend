import { CACHE } from '@app/libs'

export class PassActivationRequestCacheKey {
  // ':g2': the request's pass carries passGroups (2026-11-14)
  private static readonly cache_key_prefix = `${CACHE.ENTITY_KEY_PREFIX}passActivationRequest:g2`

  static getById(id: string): string {
    return `${this.cache_key_prefix}:id:${id}`
  }

  static studioRequests(studioId: string): string {
    return `${this.cache_key_prefix}:studioId:${studioId}`
  }
}
