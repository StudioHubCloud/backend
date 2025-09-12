import { UserProfileSelectModel } from '@app/infrastructure/database'
import { UserProfileRoleEnum } from '@app/libs'

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

  static allStudioStaffMembers(studioId: string) {
    return `${this.cache_key_prefix}:all-staff:${studioId}`
  }
  static allStudioClients(studioId: string, withArchived = false) {
    return `${this.cache_key_prefix}:all-clients:${studioId}:${withArchived}`
  }

  static activeClientsForSignIn(studioId: string, trainingId: number) {
    return `${this.cache_key_prefix}:acfsi:${studioId}:${trainingId}`
  }
}
