import { Module } from '@nestjs/common'
import { ComposersModule } from './composers'
import { HandlersModule } from './handlers/handlers.module'
import { ScenesModule } from './scenes'
import { MIDDLEWARE_SERVICE_PROVIDER, MiddlewareService } from './services'
import { BusinessModule, ClientModule, UserProfileModule } from 'src/domain'
import { BotController } from './bot.controller'
import { BotService } from './bot.service'

@Module({
  imports: [HandlersModule, ComposersModule, ScenesModule, BusinessModule, UserProfileModule, ClientModule],
  controllers: [BotController],
  providers: [BotService, { provide: MIDDLEWARE_SERVICE_PROVIDER, useClass: MiddlewareService }],
  exports: [BotService],
})
export class BotModule {}
