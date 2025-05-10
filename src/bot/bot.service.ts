import { session, Telegraf } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'

import { ComposerService, MiddlewareService, StageService } from './modules'
import { TypedConfigService } from '@app/infrastructure/config'
import { ENVIRONMENTS } from '@app/libs'
import { BotContext } from './bot.context'
import { MESSAGES_COMMON } from './static/messages'

@Injectable()
export class BotService {
  private readonly bot: Telegraf<BotContext>
  constructor(
    private readonly logger: PinoLogger,
    private readonly configService: TypedConfigService,
    private readonly middlewareService: MiddlewareService,
    private readonly stageService: StageService,
    private readonly composerService: ComposerService,
  ) {
    this.logger.setContext(BotService.name)

    const isProduction = this.configService.get('NODE_ENV') === ENVIRONMENTS.PRODUCTION
    const token = this.configService.get(isProduction ? 'BOT_TOKEN' : 'BOT_TOKEN_TEST')

    this.bot = new Telegraf<BotContext>(token, {
      contextType: BotContext,
    })

    this.bot.use(session())

    this.initMiddlewares()

    this.bot.use(this.stageService.stage.middleware()) 

    this.bot.use(this.composerService.initRootComposer)

    this.initExitGuard()

    this.bot.catch(async (err: any, ctx: BotContext) => {
      this.logger.error(`Encountered an error for ctx.update: %o, with message: %s`,ctx.update, err?.message)
      ctx.scene.leave()
      await ctx.telegram.sendMessage(this.configService.get('MAINTAINER_CHAT_ID'), `Error: ${err.message}\n\nUpdate: ${JSON.stringify(ctx.update)}`)
      ctx.reply(MESSAGES_COMMON.GLOBAL_ERROR)
    })
  }

  private initMiddlewares() {
    this.bot.use(this.middlewareService.timerMiddleware)
    this.bot.use(this.middlewareService.loggingMiddleware)
    this.bot.use(this.middlewareService.authMiddleware)
    this.bot.use(this.middlewareService.newUserRegistrationMiddleware)
  }

  private initExitGuard() {
    this.bot.action(/(.*)/, (ctx) => {
      ctx.answerCbQuery()
      const match = ctx.match[0]
      this.logger.error('Exit guard triggered with match: %s', match)
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

  stopBot(reason: 'SIGINT' | 'SIGTERM') {
    this.bot.stop(reason)
    this.logger.warn('Bot stopped with reason: %s', reason)
  }
}
