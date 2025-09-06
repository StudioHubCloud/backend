export class GroupAgeRestrictionCacheKey {
   private static readonly cache_key_prefix = 'group-a-r'


   static passedAgeRestriction(userProfileId: string, groupId: number): string {
      return `${this.cache_key_prefix}:${userProfileId}:${groupId}`
   }
}
