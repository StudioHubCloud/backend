export class TrainingSignupCacheKey {
     private static readonly cache_key_prefix = 'training-signup'

     static clientSignupsInGroup(userProfileId: string, groupId: number): string {
          return `${this.cache_key_prefix}:${userProfileId}:${groupId}`
     }

     static trainingAlreadyBooked(userProfileId: string, trainingId: number): string {
          return `${this.cache_key_prefix}:b:${userProfileId}:${trainingId}`
     }

     static clientSignups(userProfileId: string): string {
          return `${this.cache_key_prefix}:${userProfileId}`
     }
     static trainingActiveSignups(trainingId: number): string {
          return `${this.cache_key_prefix}:active:${trainingId}`
     }
     static trainingCanceledSignups(trainingId: number): string {
          return `${this.cache_key_prefix}:canceled:${trainingId}`
     }

     static activeSignupsByPassId(passId: string): string {
          return `${this.cache_key_prefix}:active:pass:${passId}`
     }
}