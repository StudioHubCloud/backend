import { BotContext } from '@app/bot/bot.context'
import { PassHelper, TextHelper, UserHelper } from '@app/bot/helpers'
import { PASS_CONFIG } from '@app/bot/libs'
import { PATTERNS_CLIENT } from '@app/bot/static/patterns'
import { PassService } from '@app/domain/pass'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { Injectable } from '@nestjs/common'
import { addDays } from 'date-fns'
import { Composer } from 'telegraf'

@Injectable()
export class PassInfoComposer {
  private readonly composer: Composer<BotContext>
  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly passService: PassService,
  ) {
    this.composer = new Composer<BotContext>()
    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initComposerHandlers() {
    this.composer.hears(PATTERNS_CLIENT.PASS_INFO, this.passInfoHandler)
  }

  private passInfoHandler = async (ctx: BotContext) => {
    const { client } = UserHelper.getUser(ctx)
    const pass = await this.passService.findActivePassByClientId(client?.id, true)
    
    if (!pass) {
      return ctx.reply('У вас немає жодного абонементу')
    }

    const isPassInactive = !pass.endDate
    const activationDate = addDays(pass.saleDate, PASS_CONFIG.ACTIVATION_GRACE_PERIOD).toISOString()
    const checkDateString = this.dateTimeProvider.formatDateStringInTz(activationDate, 'd MMMM')

    const { icon, label } = PassHelper.getPassDisplayStatus(pass.status, isPassInactive)

    const text = `${TextHelper.bold('🎫 Деталі абонементу:')}\n
${icon} ${TextHelper.bold('Статус:')} ${label}
📌 ${TextHelper.bold('Доступно тренувань:')} ${pass.availableSlots}/${pass.passTemplate.length}
📅 ${TextHelper.bold(isPassInactive ? 'Автоматично активується:' : 'Дійсний до:')} ${isPassInactive ? checkDateString : pass.endDate}
`
    await ctx.replyWithHTML(text)
  }
}
