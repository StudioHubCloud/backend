import { Module } from '@nestjs/common'
import { KeyboardModule } from './keyboard'
import { MiddlewareModule } from './middleware'
import { StageModule } from './stage'
import { ComposerModule } from './composer'
import { BotService } from './bot.service'
import { BotNotificationService } from './services'
import { BOT_INSTANCE } from './bot.instance'
import { BotCommands } from './bot.commands'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { APP } from '@app/libs'

@Module({
  imports: [KeyboardModule, MiddlewareModule, StageModule, ComposerModule],
  providers: [
    BotService,
    BotCommands,
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
