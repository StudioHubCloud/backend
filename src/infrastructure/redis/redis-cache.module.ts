import { RedisOptions } from 'ioredis'
import { CacheModule } from '@nestjs/cache-manager'
import { redisStore } from 'cache-manager-ioredis-yet'
import { Global, Module } from '@nestjs/common'
import { TypedConfigService } from '../config'
import { RedisCacheService } from './redis-cache.service'
import { CACHE, ENVIRONMENTS } from '@app/libs'

@Global()
@Module({
  imports: [
    CacheModule.registerAsync<RedisOptions>({
      isGlobal: true,
      inject: [TypedConfigService],
      useFactory: async (configService: TypedConfigService) => ({
        store: redisStore,
        url: configService.get('REDIS_URL'),
        ttl: CACHE.DEFAULT_TTL,
      }),
    }),
  ],
  providers: [RedisCacheService],
  exports: [CacheModule, RedisCacheService],
})
export class RedisCacheModule {}
