import { Global, Module } from '@nestjs/common'
import Redis from 'ioredis'
import { TypedConfigService } from '../config'
import { RedisCacheService } from './redis-cache.service'

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [TypedConfigService],
      useFactory: (configService: TypedConfigService) => {
        console.log(configService.get('REDIS_URL'))
        return new Redis(configService.get('REDIS_URL'))
      },
    },
    RedisCacheService,
  ],
  exports: [RedisCacheService],
})
export class RedisCacheModule {}
