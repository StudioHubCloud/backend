
export class PaymentCacheKey {
  private static readonly cache_key_prefix = 'payment'

  static lastStaffPayoutDate(staffMemberId: string): string {
    return `${this.cache_key_prefix}:lpd:${staffMemberId}`
  }

  static paymentByFilterConditions(filters: Record<string, any>) {
    return `${this.cache_key_prefix}:${JSON.stringify(filters)}`
  }

  static staffPayoutSalary(staffMemberId: string, lastPayoutDate: string, endDate?: string): string {
    return `${this.cache_key_prefix}:sps:${staffMemberId}:${lastPayoutDate}:${endDate || ''}`
  }
}
  