import { BotContext } from '@app/bot/bot.context'
import { BotHelper, PassHelper, PersonalTrainingHelper, RegexHelper, UserHelper } from '@app/bot/helpers'
import { ClientKeyboards, PersonalTrainingKeyboards } from '@app/bot/keyboard/storage'
import { CALLBACK_PREFIX } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { PassSelectionHelper, PassService } from '@app/domain/pass'
import { MESSAGES_CLIENT } from '@app/bot/static/messages'
import { PersonalTrainingSignupService } from '@app/domain/personal-training-signup'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { PassTemplateTypeEnum } from '@app/libs'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'

@Injectable()
export class PassInfoComposer {
  private readonly composer: Composer<BotContext>
  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly passService: PassService,
    private readonly personalTrainingSignupService: PersonalTrainingSignupService,
  ) {
    this.composer = new Composer<BotContext>()
    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initComposerHandlers() {
    this.composer.hears(BUTTON_PATTERNS.PASS_INFO, this.passInfoHandler)
    this.composer.action(CALLBACK_PREFIX.CLIENT.PASS_RULES, this.passRulesHandler)
    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.PASS_SWITCH), this.passSwitchHandler)
  }

  /**
   * For a group pass this is the plain pass card. For an individual pass it doubles as the
   * client's cabinet: remaining sessions plus the history of individual trainings.
   */
  private passInfoHandler = async (ctx: BotContext) => {
    return this.renderPassInfo(ctx, false)
  }

  /**
   * The current pass's card. With several active passes, a button per pass switches the current one (the pass the
   * client works with: highlighted group in "Розклад", this card).
   */
  private renderPassInfo = async (ctx: BotContext, shouldEdit: boolean) => {
    const { client } = UserHelper.getUser(ctx)
    const pass = await this.passService.findActivePassByClientId(client?.id, { withExpired: true, withRequested: true })

    if (!pass || !client) {
      return ctx.reply('📋 В тебе немає жодного абонементу')
    }

    const isIndividual = pass.passTemplate.type === PassTemplateTypeEnum.INDIVIDUAL
    let message = isIndividual
      ? PersonalTrainingHelper.getClientCabinetMessage(
          pass,
          await this.personalTrainingSignupService.getClientSignups(client.id),
          this.dateTimeProvider,
        )
      : PassHelper.getPassInfoMessage(pass, this.dateTimeProvider)

    const { passes } = await this.passService.findActivePassesByClientId(client.id)
    const hasChoice = passes.length > 1
    if (hasChoice) {
      message += `\n\n${MESSAGES_CLIENT.PASS_SWITCH_HINT}`
    }

    const keyboard = hasChoice
      ? ClientKeyboards.passSwitch(passes, pass.id, { withRules: isIndividual })
      : isIndividual
        ? PersonalTrainingKeyboards.passRulesButton()
        : undefined

    return shouldEdit ? BotHelper.safeEditMessageText(ctx, message, keyboard) : ctx.replyWithHTML(message, keyboard)
  }

  /** The client picks the current pass; the client comes from the session, the service checks the pass is theirs. */
  private passSwitchHandler = async (ctx: BotContext) => {
    const { client } = UserHelper.getUser(ctx)
    const [passId] = RegexHelper.getMatchGroupValue(ctx)

    if (!client || !passId) {
      return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_CLIENT.PASS_SWITCH_GONE, { show_alert: true })
    }

    try {
      const pass = await this.passService.setCurrentPass(client.id, passId)
      await BotHelper.safeAnswerCbQuery(ctx, `✨ Поточний: ${PassSelectionHelper.getLabel(pass)}`)
    } catch {
      await BotHelper.safeAnswerCbQuery(ctx, MESSAGES_CLIENT.PASS_SWITCH_GONE, { show_alert: true })
    }

    return this.renderPassInfo(ctx, true)
  }

  private passRulesHandler = async (ctx: BotContext) => {
    BotHelper.safeAnswerCbQuery(ctx)
    const { client } = UserHelper.getUser(ctx)
    const pass = await this.passService.findActivePassByClientId(client?.id, { withExpired: true, withRequested: true })
    return ctx.replyWithHTML(PassHelper.getRulesMessage(pass?.passTemplate))
  }
}
