import { Module } from '@nestjs/common'

import { BotService } from './bot.service'
import { ComposerModule, InlineMenuModule, KeyboardModule, MiddlewareModule, StageModule } from './modules'

@Module({
  imports: [KeyboardModule, MiddlewareModule, StageModule, ComposerModule, InlineMenuModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
