export class StudioPayoutRuleCacheKey {
  private static readonly cache_key_prefix = 'spr'

  static allRulesByStudioId(studioId: string): string {
    return `${this.cache_key_prefix}:all_studio:${studioId}`
  }
}
