import { UserProfileSelectModel } from '@app/infrastructure/database'

export class UserProfileCacheKey {
  private static readonly cache_key_prefix = 'user-profile'

  static telegramAuthUser(studioId: string, telegramId: string): string {
    return `${this.cache_key_prefix}:t:${studioId}:${telegramId}`
  }

  static userProfileByConditions(conditions: Partial<UserProfileSelectModel>): string {
    return `${this.cache_key_prefix}:${JSON.stringify(conditions)}`
  }

  static userProfileById(userProfileId: string): string {
    return `${this.cache_key_prefix}:${userProfileId}`
  }
}
