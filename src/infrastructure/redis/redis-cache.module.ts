import { RedisOptions } from 'ioredis'
import { CacheModule } from '@nestjs/cache-manager'
import { redisStore } from 'cache-manager-ioredis-yet'
import { Global, Module } from '@nestjs/common'
import { TypedConfigService } from '../config'
import { RedisCacheService } from './redis-cache.service'
import { CACHE } from '@app/libs'

@Global()
@Module({
  imports: [
    CacheModule.registerAsync<RedisOptions>({
      isGlobal: true,
      inject: [TypedConfigService],
      useFactory: async (configService: TypedConfigService) => {

         const redisUrl = configService.get('REDIS_URL')
        console.log('🔴 Connecting to Redis URL:', redisUrl)

        return {
          store: redisStore,
          url: redisUrl,
          ttl: CACHE.DEFAULT_TTL,
        }
      },
    }),
  ],
  providers: [RedisCacheService],
  exports: [CacheModule, RedisCacheService],
})
export class RedisCacheModule {}
