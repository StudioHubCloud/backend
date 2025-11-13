import { session, Telegraf } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { TypedConfigService } from '@app/infrastructure/config'
import { ENVIRONMENTS } from '@app/libs'
import { BotContext } from './bot.context'
import { BotCommands } from './bot.commands'
import { MESSAGES_COMMON } from './static/messages'
import { MiddlewareService } from './middleware'
import { StageService } from './stage'
import { ComposerService } from './composer'
import { BotHelper, KeyboardHelper, RegexHelper, UserHelper } from './helpers'
import { CALLBACK_DATA } from './libs'

@Injectable()
export class BotService {
  private readonly bot: Telegraf<BotContext>
  constructor(
    private readonly logger: PinoLogger,
    private readonly configService: TypedConfigService,
    private readonly middlewareService: MiddlewareService,
    private readonly stageService: StageService,
    private readonly composerService: ComposerService,
    private readonly botCommands: BotCommands,
  ) {
    this.logger.setContext(BotService.name)

    this.bot = new Telegraf<BotContext>(this.configService.getToken(), {
      contextType: BotContext,
    })

    this.bot.use(session())

    this.initMiddlewares()

    this.bot.use(this.botCommands.middleware())

    this.bot.use(this.stageService.stage.middleware())

    this.bot.use(this.composerService.useGuardComposer)
    this.bot.use(this.composerService.useRootComposer)

    this.initExitGuard()

    this.bot.catch(async (err: any, ctx: BotContext): Promise<void> => {
      this.logger.error(`Encountered an error for ctx.update: %o, with message: %s`, ctx.update, err?.message)
      ctx?.scene?.leave()
      BotHelper.safeSendMessage(
        ctx,
        this.configService.get('MAINTAINER_CHAT_ID'),
        `Error: ${err.message}\n\nUpdate: ${JSON.stringify(ctx?.update)}`,
      )
      ctx?.reply(MESSAGES_COMMON.GLOBAL_ERROR)
      return
    })
  }

  private initMiddlewares() {
    this.bot.use(this.middlewareService.auditLogMiddleware)
    this.bot.use(this.middlewareService.timerMiddleware)
    this.bot.use(this.middlewareService.loggingMiddleware)
    this.bot.use(this.middlewareService.authMiddleware)
  }

  private initExitGuard() {
    this.bot.action(RegexHelper.createSimpleRegex(CALLBACK_DATA.CLOSE_MENU), (ctx) => {
      BotHelper.safeAnswerCbQuery(ctx)
      ctx.deleteMessage()
      return
    })

    this.bot.hears('🚪 Вийти', (ctx) => {
      const user = UserHelper.getUser(ctx)
      ctx.replyWithHTML('Головне меню', KeyboardHelper.getRoleBasedMainMenuKeyboard(user.role))
      this.logger.error('Global Scene Exit guard triggered for userId: %s', user.telegramId)

      if (ctx.scene.current?.id) {
        ctx.scene.leave()
      }
      return
    })

    this.bot.action(/(.*)/, (ctx) => {
      BotHelper.safeAnswerCbQuery(ctx)
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

  getBotInstance(): Telegraf<BotContext> {
    return this.bot
  }
}
