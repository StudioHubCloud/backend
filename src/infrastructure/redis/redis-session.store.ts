import Redis from 'ioredis'
import { Inject, Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { BOT_SESSION } from '@app/libs'
import { REDIS_CACHE_CLIENT } from './redis-cache.symbol'
import { MetricsService } from '../metrics'

/**
 * Telegraf session store (async `get`/`set`/`delete`) on the shared ioredis client.
 * Sessions survive deploys and work across replicas; the TTL is refreshed on every write.
 * Fail-soft: a Redis error never breaks an update — reads fall back to an empty session, writes are logged.
 */
@Injectable()
export class RedisSessionStore {
  constructor(
    @Inject(REDIS_CACHE_CLIENT) private readonly redis: Redis,
    private readonly metricsService: MetricsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RedisSessionStore.name)
  }

  async get<S>(name: string): Promise<S | undefined> {
    try {
      const result = await this.redis.get(this.key(name))
      return result ? (JSON.parse(result) as S) : undefined
    } catch (error) {
      this.metricsService.recordRedisCommandError('get')
      this.logger.error('Error reading session %s; continuing with an empty session: %j', name, error)
      return undefined
    }
  }

  async set<S>(name: string, value: S): Promise<void> {
    try {
      await this.redis.setex(this.key(name), BOT_SESSION.TTL, JSON.stringify(value))
    } catch (error) {
      this.metricsService.recordRedisCommandError('setex')
      this.logger.error('Error writing session %s: %j', name, error)
    }
  }

  async delete(name: string): Promise<void> {
    try {
      await this.redis.del(this.key(name))
    } catch (error) {
      this.metricsService.recordRedisCommandError('del')
      this.logger.error('Error deleting session %s: %j', name, error)
    }
  }

  private key(name: string) {
    return `${BOT_SESSION.KEY_PREFIX}${name}`
  }
}
