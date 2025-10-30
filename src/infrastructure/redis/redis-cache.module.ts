import { Global, Module } from '@nestjs/common'
import Redis from 'ioredis'
import { TypedConfigService } from '../config'
import { RedisCacheService } from './redis-cache.service'
import { ENVIRONMENTS } from '@app/libs'

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [TypedConfigService],
      useFactory: (configService: TypedConfigService) => {
        console.log(configService.get('REDIS_URL'), 'RESOLVED REDIS URL')
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
