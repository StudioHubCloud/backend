import { Module } from '@nestjs/common'

import { BotService } from './bot.service'
import { ComposerModule, KeyboardModule, MiddlewareModule, StageModule } from './modules'
import { BotNotificationService } from './services'
import { BOT_INSTANCE } from './bot.instance'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { APP } from '@app/libs'

@Module({
  imports: [KeyboardModule, MiddlewareModule, StageModule, ComposerModule],
  providers: [
    BotService,
    BotNotificationService,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
    {
      provide: BOT_INSTANCE,
      useFactory: (botService: BotService) => botService.getBotInstance(),
      inject: [BotService],
    },
  ],
  exports: [BotService, BotNotificationService],
})
export class BotModule {}
