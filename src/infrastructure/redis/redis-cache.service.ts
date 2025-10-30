import Redis from 'ioredis'
import { Inject, Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { REDIS_CACHE_CLIENT } from './redis-cache.symbol'
import { CACHE } from '@app/libs'

@Injectable()
export class RedisCacheService {
  constructor(
    @Inject(REDIS_CACHE_CLIENT) private readonly redis: Redis,
    private readonly logger: PinoLogger,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await this.redis.get(key)
      if (result) {
        this.logger.debug('[GET CACHE] by key: %s', key)
        return JSON.parse(result) as T
      }
      return null
    } catch (error) {
      this.logger.error('Error getting value from cache with key: %s; %j', key, error)
      return null
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number = CACHE.DEFAULT_TTL): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value))
      this.logger.debug('[SET CACHE] by key: %s, ttl: %ds', key, ttlSeconds)
    } catch (error) {
      this.logger.error('Error setting value in cache with key: %s; %j', key, error)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key)
      this.logger.debug('[DELETE CACHE] by key: %s', key)
    } catch (error) {
      this.logger.error('Error deleting value from cache with key: %s; %j', key, error)
    }
  }

  async reset(): Promise<void> {
    try {
      await this.redis.flushdb()
      this.logger.debug('[CLEAR CACHE] success')
    } catch (error) {
      this.logger.error('Error clearing cache: %j', error)
    }
  }
}
