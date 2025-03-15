import { ENVIRONMENTS } from '@app/libs'
import { TypedConfigService } from '@app/infrastructure/config'
import { Inject, Injectable } from '@nestjs/common'
import { Bot, CommandContext, GrammyError, HttpError } from 'grammy'
import { Update } from 'grammy/types'
import { PinoLogger } from 'nestjs-pino'
import { MIDDLEWARE_SERVICE_PROVIDER, MiddlewareService } from './services'
import { BotContext } from './bot.context'

@Injectable()
export class BotService {
  private bot: Bot

  constructor(
    private readonly logger: PinoLogger,
    private readonly configService: TypedConfigService,
    @Inject(MIDDLEWARE_SERVICE_PROVIDER) private readonly middlewareService: MiddlewareService,
  ) {
    this.bot = new Bot(this.configService.get('BOT_TOKEN'), { ContextConstructor: BotContext })
    this.bot.use(this.middlewareService.validateUser)

    this.bot.command('start', (ctx: CommandContext<BotContext>) => {
      console.log(ctx)
      ctx.reply(`Welcome ${ctx.state.user.fullName}, how can I help you?`)
    })
    this.bot.catch((err) => {
      this.bot.api.sendMessage(this.configService.get('MAINTAINER_CHAT_ID'), `Error in bot: ${err.message}`)
      this.logger.error('Error in bot', err)
    })
  }

  async handleUpdate(update: Update) {
    console.log(update, 'UPDATE')
    await this.bot.handleUpdate(update)
  }

  async init() {
    try {
      if (process.env.NODE_ENV === ENVIRONMENTS.PRODUCTION) {
        await this.startWebhook()
      } else {
        await this.startPolling()
      }

      this.bot.catch((err) => {
        const ctx = err.ctx
        this.logger.error(`Error handling update ${ctx.update.update_id}:`)
        const e = err.error
        if (e instanceof GrammyError) {
          this.logger.error('Error in request:', e.description)
        } else if (e instanceof HttpError) {
          this.logger.error('Could not contact Telegram:', e)
        } else {
          console.log(e, 'ERROR')
          this.logger.error('Unknown error:', e)
        }
      })
    } catch (err) {
      this.logger.error('Failed to start bot:', err)
    }
  }

  private async startPolling() {
    this.bot.start()
    this.logger.info('Bot started in polling mode')
  }

  private async startWebhook() {
    const url = this.configService.get('WEBHOOK_URL')
    await this.bot.api.setWebhook(url)
    this.logger.info(`Bot running in webhook mode: ${url}`)
  }
}
