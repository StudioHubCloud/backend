import { GroupSelectModel } from '@app/infrastructure/database'
import { CACHE } from '@app/libs'

export class GroupCacheKey {
   private static readonly cache_key_prefix = `${CACHE.ENTITY_KEY_PREFIX}group`


  static groupById(id: number): string {
      return `${this.cache_key_prefix}:id:${id}`
   }

   static groupByFilterConditions(filters: Partial<GroupSelectModel>) {
      return `${this.cache_key_prefix}:${JSON.stringify(filters)}`
   }
}
