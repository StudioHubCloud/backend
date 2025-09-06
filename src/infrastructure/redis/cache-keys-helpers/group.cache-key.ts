import { GroupSelectModel } from '@app/infrastructure/database'

export class GroupCacheKey {
   private static readonly cache_key_prefix = 'group'


  static groupById(id: number): string {
      return `${this.cache_key_prefix}:id:${id}`
   }

   static groupByFilterConditions(filters: Partial<GroupSelectModel>) {
      return `${this.cache_key_prefix}:${JSON.stringify(filters)}`
   }
}
