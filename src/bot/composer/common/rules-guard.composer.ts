import { BotContext } from '@app/bot/bot.context'
import { BotHelper, PassHelper, ProfileMenuHelper, RegexHelper, UserHelper } from '@app/bot/helpers'
import { CommonKeyboards } from '@app/bot/keyboard/storage'
import { CALLBACK_PREFIX, TNextFunction } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { PassService } from '@app/domain/pass'
import { UserProfileService } from '@app/domain/user-profile'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'

@Injectable()
export class RulesGuardComposer {
  private readonly composer: Composer<BotContext>
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly passService: PassService,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    this.composer = new Composer<BotContext>()

    this.initComposerActions()

    this.composer.use(this.rulesConsentGuard)

    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  /**
   * Rules consent of the person the client screens act for: self (group / individual rules by the pass), or a parent's
   * child (parents' rules by the child's age; the parent agrees, the consent is saved on the child). A parent who doesn't
   * train (no pass of their own, has children) has nothing to agree to for themselves.
   */
  private rulesConsentGuard = async (ctx: BotContext, next: TNextFunction) => {
    const acting = UserHelper.getActingUser(ctx)
    if (acting.consentToRules) {
      return await next()
    }

    const isChild = UserHelper.isActingForChild(ctx)
    if (!isChild && !acting.client?.pass?.length && (await this.userProfileService.findChildren(acting.id)).length) {
      return await next()
    }

    const pass = await this.passService.findActivePassByClientId(acting.client?.id, { withExpired: true, withRequested: true })
    const childAge = isChild ? UserHelper.getActingChildAge(ctx, this.dateTimeProvider) : null
    if (BotHelper.getUpdatePayload(ctx).isCallbackQueryUpdate) {
      await BotHelper.safeAnswerCbQuery(ctx)
    }
    const card = await ctx.replyWithHTML(PassHelper.getRulesConsentMessage(pass?.passTemplate, { childAge }), CommonKeyboards.consentToRules())
    // «Погоджуюсь» saves the consent of this profile: bound to it (profileMenuGuardMiddleware)
    ProfileMenuHelper.bind(ctx, card.message_id)
    return card
  }

  initComposerActions() {
    // Saved for the acting profile (validated in authMiddleware); a card shown for another profile never gets here (guard)
    this.composer.action(RegexHelper.createSimpleRegex(CALLBACK_PREFIX.COMMON.AGREE_TO_RULES), async (ctx: BotContext) => {
      const { id } = UserHelper.getActingUser(ctx)
      await this.userProfileService.consentToRules(id)
      await BotHelper.safeDeleteMessage(ctx)
      return BotHelper.safeAnswerCbQuery(ctx, 'Дякуємо за згоду з правилами! ❤️', { show_alert: true })
    })
  }

  initComposerHandlers() {
    // «📜 Правила та умови» in «✨ Більше»; the old main-menu button keeps working for old keyboards
    this.composer.hears([BUTTON_PATTERNS.MORE_RULES, BUTTON_PATTERNS.RULES], this.rulesHandler)
  }

  /** Rules of the pass the screens act for (a child: parents' rules by the child's age). */
  private rulesHandler = async (ctx: BotContext) => {
    const { client } = UserHelper.getActingUser(ctx)
    const pass = await this.passService.findActivePassByClientId(client?.id, { withExpired: true, withRequested: true })
    const childAge = UserHelper.getActingChildAge(ctx, this.dateTimeProvider)
    return ctx.replyWithHTML(PassHelper.getRulesMessage(pass?.passTemplate, { childAge }))
  }
}
