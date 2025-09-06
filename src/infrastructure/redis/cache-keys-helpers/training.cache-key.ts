export class TrainingCacheKey {
   private static readonly cache_key_prefix = 'training'


   static trainingsForSchedule(groupId: number, userId: string): string {
      return `${this.cache_key_prefix}:${groupId}:${userId}`
   }

   static trainingsForManage(groupId: number): string {
      return `${this.cache_key_prefix}:${groupId}:manage`
   }

   static trainingById(trainingId: number): string {
      return `${this.cache_key_prefix}:${trainingId}`
   }
}
