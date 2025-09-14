export class PassActivationRequestCacheKey {
  private static readonly cache_key_prefix = 'passActivationRequest'

  static getById(id: string): string {
    return `${this.cache_key_prefix}:id:${id}`
  }

  static studioRequests(studioId: string): string {
    return `${this.cache_key_prefix}:studioId:${studioId}`
  }
}
