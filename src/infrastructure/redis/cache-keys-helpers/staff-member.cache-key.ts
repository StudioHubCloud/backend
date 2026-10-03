import { CACHE } from '@app/libs'


export class StaffMemberCacheKey {
  private static readonly cache_key_prefix = `${CACHE.ENTITY_KEY_PREFIX}staff`

  static staffMemberById(id: string): string {
    return `${this.cache_key_prefix}:id:${id}`
  }

  static staffMemberByFilterConditions(filters: Record<string, any>) {
    return `${this.cache_key_prefix}:${JSON.stringify(filters)}`
  }
}
  