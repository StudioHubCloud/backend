import { BotContext } from '@app/bot/bot.context'
import { PassHelper, TextHelper, UserHelper } from '@app/bot/helpers'
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

    const { icon, label } = PassHelper.getPassDisplayStatus(pass.status)

    const text = `${TextHelper.bold('Деталі абонементу:')}\n
${icon} ${TextHelper.bold('Статус:')} ${label}
✔️ ${TextHelper.bold('Залишилось занять:')} ${pass.availableSlots}\n
📅 ${TextHelper.bold('Початок дії:')} ${pass.startDate.substring(0, 10)}
📅 ${TextHelper.bold('Закінчення дії:')} ${pass.endDate.substring(0, 10)}
💰 ${TextHelper.bold('Вартість:')} ${PassHelper.toDisplayPrice(pass.price)}
🎫 ${TextHelper.bold('Кількість занять:')} ${pass.length} (всього)
${pass.pausedFromDate ? `⏸️ ${TextHelper.bold('Призупинено:')} з ${pass.pausedFromDate.substring(0, 10)} до ${pass.pausedToDate?.substring(0, 10)}` : ''}
${pass.expiredFromDate ? `❌ ${TextHelper.bold('Термін дії минув:')} ${pass.expiredFromDate.substring(0, 10)}` : ''}
`
    await ctx.replyWithHTML(text)
  }
}
