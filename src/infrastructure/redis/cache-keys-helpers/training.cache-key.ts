export class TrainingCacheKey {
   private static readonly cache_key_prefix = 'training'


   static trainingsForSchedule(groupId: string, userId: string): string {
      return `${this.cache_key_prefix}:${groupId}:${userId}`
   }

   static trainingsForManage(groupId: string): string {
      return `${this.cache_key_prefix}:${groupId}:manage`
   }

   static trainingById(trainingId: string): string {
      return `${this.cache_key_prefix}:${trainingId}`
   }
}
