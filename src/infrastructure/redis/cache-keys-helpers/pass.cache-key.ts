export class PassCacheKey {
  private static readonly cache_key_prefix = 'pass'

  static passById(passId: string, studioId: string): string {
    return `${this.cache_key_prefix}:id:${passId}:${studioId}`
  }

  static passByClientId(clientId: string, studioId: string): string {
    return `${this.cache_key_prefix}:${clientId}:${studioId}`
  }

  static passActivationRequests(studioId: string): string {
    return `${this.cache_key_prefix}:ar:${studioId}`
  }
}
