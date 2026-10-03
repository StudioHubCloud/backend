import { BotContext } from '@app/bot/bot.context'
import { BotHelper, PassHelper, PersonalTrainingHelper, UserHelper } from '@app/bot/helpers'
import { PersonalTrainingKeyboards } from '@app/bot/keyboard/storage'
import { CALLBACK_PREFIX } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { RULES_INDIVIDUAL_PASS } from '@app/bot/static/messages'
import { PassService } from '@app/domain/pass'
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
  }

  /**
   * For a group pass this is the plain pass card. For an individual pass it doubles as the
   * client's cabinet: remaining sessions plus the history of individual trainings.
   */
  private passInfoHandler = async (ctx: BotContext) => {
    const { client } = UserHelper.getUser(ctx)
    const pass = await this.passService.findActivePassByClientId(client?.id, { withExpired: true, withRequested: true })

    if (!pass) {
      return ctx.reply('📋 В тебе немає жодного абонементу')
    }

    if (pass.passTemplate.type === PassTemplateTypeEnum.INDIVIDUAL && client) {
      const personalTrainings = await this.personalTrainingSignupService.getClientSignups(client.id)
      const message = PersonalTrainingHelper.getClientCabinetMessage(pass, personalTrainings, this.dateTimeProvider)

      return ctx.replyWithHTML(message, PersonalTrainingKeyboards.passRulesButton())
    }

    const message = PassHelper.getPassInfoMessage(pass, this.dateTimeProvider)
    return ctx.replyWithHTML(message)
  }

  private passRulesHandler = async (ctx: BotContext) => {
    BotHelper.safeAnswerCbQuery(ctx)
    return ctx.replyWithHTML(RULES_INDIVIDUAL_PASS)
  }
}
