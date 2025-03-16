import { Global, Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { TypedConfigService } from './config.service'
import config from './environments'

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      load: [config],
    }),
  ],
  providers: [TypedConfigService],
  exports: [TypedConfigService],
})
export class ConfigModule {}
