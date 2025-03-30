import { CACHE } from '@app/libs'
import { Cache } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'

@Injectable()
export class RedisCacheService {
  constructor(
    @Inject(Cache) private readonly cacheManager: Cache,
    private readonly logger: PinoLogger,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await this.cacheManager.get<T>(key)
      if (result) {
        this.logger.debug('[GET CACHE] by key: %s', key)
      }
      return result
    } catch (error) {
      this.logger.error('Error getting value from cache with key: %s; %j', key, error)
      return null
    }
  }

  async set<T>(key: string, value: T, ttl: number = CACHE.DEFAULT_TTL): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl)
      this.logger.debug('[SET CACHE] by key: %s', key)
    } catch (error) {
      this.logger.error('Error setting value in cache with key: %s; %j', key, error)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key)
      this.logger.debug('[DELETE CACHE] by key: %s', key)
    } catch (error) {
      this.logger.error('Error deleting value from cache with key: %s; %j', key, error)
    }
  }

  async reset(): Promise<void> {
    try {
      await this.cacheManager.clear()
      this.logger.debug('[CLEAR CACHE] success')
    } catch (error) {
      this.logger.error('Error clearing cache: %j', error)
    }
  }
}
