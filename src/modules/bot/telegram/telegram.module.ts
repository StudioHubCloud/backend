import { Module } from '@nestjs/common'
import { TelegramController } from './telegram.controller'
import { TelegramService } from './telegram.service'
import { ComposersModule } from '../composers'
import { HandlersModule } from '../handlers/handlers.module'
import { ScenesModule } from '../scenes'

@Module({
  imports: [HandlersModule, ComposersModule, ScenesModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
