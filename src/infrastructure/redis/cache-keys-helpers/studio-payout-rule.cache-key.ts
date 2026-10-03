import { CACHE } from '@app/libs'

export class StudioPayoutRuleCacheKey {
  private static readonly cache_key_prefix = `${CACHE.ENTITY_KEY_PREFIX}spr`

  static allRulesByStudioId(studioId: string): string {
    return `${this.cache_key_prefix}:all_studio:${studioId}`
  }
}
