export class TrainingSignupCacheKey {
     private static readonly cache_key_prefix = 'training-signup'

     static clientSignupsInGroup(userProfileId: string, groupId: string): string {
          return `${this.cache_key_prefix}:${userProfileId}:${groupId}`
     }

     static trainingAlreadyBooked(userProfileId: string, trainingId: string): string {
          return `${this.cache_key_prefix}:b:${userProfileId}:${trainingId}`
     }
}