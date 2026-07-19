import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { SCENES } from '@app/bot/libs'

// Entry point only — tapping the button hands off to AskAiScene, which owns the whole
// conversation (welcome message, free-text handling, confirm/cancel, exit).
@Injectable()
export class AskAiComposer {
  private readonly composer: Composer<BotContext>

  constructor() {
    this.composer = new Composer<BotContext>()

    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initComposerHandlers() {
    this.composer.hears(BUTTON_PATTERNS.ASK_AI, (ctx) => ctx.scene.enter(SCENES.ASK_AI))
  }
}
