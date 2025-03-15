import { ENVIRONMENTS } from '@app/libs'
import { TypedConfigService } from '@app/modules/infrastructure/config'
import { Injectable } from '@nestjs/common'
import { Bot, GrammyError, HttpError } from 'grammy'
import { Update } from 'grammy/types'
import { StartComposer } from '../composers'
import { PinoLogger } from 'nestjs-pino'

@Injectable()
export class TelegramService {
  private bot: Bot

  constructor(
    private readonly configService: TypedConfigService,
    private readonly startComposer: StartComposer,
    private readonly logger: PinoLogger,
  ) {
    this.bot = new Bot(this.configService.get('BOT_TOKEN'))
    this.bot.use(this.startComposer)
  }

  async handleUpdate(update: Update) {
    await this.bot.handleUpdate(update)
  }

  async init() {
    try {
      if (process.env.NODE_ENV === ENVIRONMENTS.PRODUCTION) {
        await this.startWebhook(this.configService.get('WEBHOOK_URL'))
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

  private async startWebhook(url: string) {
    await this.bot.api.setWebhook(url)
    this.logger.info(`Bot running in webhook mode: ${url}`)
  }
}
