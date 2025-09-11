import { BotContext } from '@app/bot/bot.context'
import { RulesConsentGuard } from '@app/bot/guards/rules-consent.guard'
import { BotHelper, RegexHelper, UserHelper } from '@app/bot/helpers'
import { CALLBACK_PREFIX } from '@app/bot/libs'
import { RULES } from '@app/bot/static/messages'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { UserProfileService } from '@app/domain/user-profile'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'

@Injectable()
export class RulesGuardComposer {
  private readonly composer: Composer<BotContext>
  constructor(private readonly userProfileService: UserProfileService) {
    this.composer = new Composer<BotContext>()

    this.initComposerActions()

    this.composer.use(RulesConsentGuard)

    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initComposerActions() {
    this.composer.action(RegexHelper.createSimpleRegex(CALLBACK_PREFIX.COMMON.AGREE_TO_RULES), async (ctx: BotContext) => {
      const { id } = UserHelper.getUser(ctx)
      await this.userProfileService.consentToRules(id)
      await ctx.deleteMessage()
      return BotHelper.safeAnswerCbQuery(ctx, 'Дякуємо за згоду з правилами! ❤️', { show_alert: true })
    })
  }

  initComposerHandlers() {
    this.composer.hears(BUTTON_PATTERNS.RULES, async (ctx: BotContext) => {
      return ctx.replyWithHTML(RULES)
    })
  }
}
