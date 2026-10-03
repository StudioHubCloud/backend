import { CACHE } from '@app/libs'

export class PaymentCacheKey {
  private static readonly cache_key_prefix = `${CACHE.ENTITY_KEY_PREFIX}payment`
}
