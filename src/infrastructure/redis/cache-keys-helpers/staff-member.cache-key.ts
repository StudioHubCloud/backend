
export class StaffMemberCacheKey {
  private static readonly cache_key_prefix = 'staff'

  static staffMemberById(id: string): string {
    return `${this.cache_key_prefix}:id:${id}`
  }

  static staffMemberByFilterConditions(filters: Record<string, any>) {
    return `${this.cache_key_prefix}:${JSON.stringify(filters)}`
  }
}
  