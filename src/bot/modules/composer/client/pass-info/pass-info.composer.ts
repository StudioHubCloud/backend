import { BotContext } from '@app/bot/bot.context'
import { TextHelper, UserHelper } from '@app/bot/helpers'
import { PATTERNS_CLIENT } from '@app/bot/static/patterns'
import { PassService } from '@app/domain/pass'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'

@Injectable()
export class PassInfoComposer {
  private readonly composer: Composer<BotContext>
  constructor(private readonly passService: PassService) {
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
    const pass = await this.passService.findActivePassByClientId(client?.id)

    if (!pass) {
      return ctx.reply('У вас немає активного абонементу')
    }
    console.log(pass, 'pass')

    //different text icon and status text

    const text = `${TextHelper.bold('Інформація про абонемент:')}\n
🟢 ${TextHelper.bold('Статус:')} ${pass.status}\n
📅 ${TextHelper.bold('Період дії:')} ${pass.startDate.substring(0, 10)} - ${pass.endDate.substring(0, 10)}
💰 ${TextHelper.bold('Вартість абонементу:')} ₴${pass.price / 100}
📝 ${TextHelper.bold('Кількість записів (Усього):')} ${pass.length}\n
🗓️ ${TextHelper.bold('Кількість доступних днів:')} ${pass.length} днів
✔️ ${TextHelper.bold('Кількість доступних записів:')} ${pass.availableSlots}
`
    await ctx.replyWithHTML(text)
  }
}
