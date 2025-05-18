export class PassCacheKey {
  private static readonly cache_key_prefix = 'pass'


  static passByClientId(clientId: string): string {
    return `${this.cache_key_prefix}:${clientId}`
  }
}
