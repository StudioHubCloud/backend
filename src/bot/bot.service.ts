import { TypedConfigService } from '@app/infrastructure/config'
import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { BotContext } from './bot.context'
import { Telegraf } from 'telegraf'
import { ENVIRONMENTS } from '@app/libs'

@Injectable()
export class BotService {
  private readonly bot: Telegraf<BotContext>
  constructor(
    private readonly logger: PinoLogger,
    private readonly configService: TypedConfigService,
  ) {
    this.logger.setContext(BotService.name)
    const token = this.configService.get(process.env.NODE_ENV === ENVIRONMENTS.PRODUCTION ? 'BOT_TOKEN' : 'BOT_TOKEN_TEST')
    this.bot = new Telegraf<BotContext>(token, {
      contextType: BotContext,
    })
    this.setupBotCommands()
  }

  private setupBotCommands() {
    this.bot.start((ctx) => {
      this.logger.info(`New /start command from user ${ctx.from.id}`)
      ctx.reply('Welcome!')
    })
  }

  startPolling() {
    this.bot.launch()
    this.logger.info('Bot started in polling mode')
  }

  getWebhookMiddleware() {
    this.logger.info('Bot started in Webhook mode')
    return this.bot.createWebhook({
      domain: `${process.env.RAILWAY_PUBLIC_DOMAIN}`,
      secret_token: this.bot.secretPathComponent(),
    })
  }
}
