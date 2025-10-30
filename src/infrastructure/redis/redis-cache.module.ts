import Redis from 'ioredis'
import { Global, Module } from '@nestjs/common'
import { TypedConfigService } from '../config'
import { RedisCacheService } from './redis-cache.service'
import { REDIS_CACHE_CLIENT } from './redis-cache.symbol'

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CACHE_CLIENT,
      inject: [TypedConfigService],
      useFactory: (configService: TypedConfigService) => {
        return new Redis(configService.get('REDIS_URL'), {
          family: 6,
          tls: undefined,
        })
      },
    },
    RedisCacheService,
  ],
  exports: [RedisCacheService],
})
export class RedisCacheModule {}
