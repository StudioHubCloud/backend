import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'
import { BotContext } from './bot.context'
import { ERA_STUDIO_LOGO_320_DEV, ERA_STUDIO_LOGO_320_PROD } from './libs'
import { TypedConfigService } from '@app/infrastructure/config'
import { UserProfileService } from '@app/domain/user-profile'
import { TextHelper, UserHelper } from './helpers'

@Injectable()
export class BotCommands {
  private readonly composer: Composer<BotContext>
  constructor(
    private readonly typedConfigService: TypedConfigService,
    private readonly userProfileService: UserProfileService,
  ) {
    this.composer = new Composer<BotContext>()
    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initComposerHandlers() {
    //add schedule commant with screenshots of current schedule
    this.composer.command('start', async (ctx, next) => {
      if (ctx.scene) {
        await ctx.scene.leave()
      }
      await next()
    })

    this.composer.command('info', (ctx) => {
      const logo = this.typedConfigService.isProduction() ? ERA_STUDIO_LOGO_320_PROD : ERA_STUDIO_LOGO_320_DEV
      return ctx.replyWithPhoto(logo, {
        caption: `⭐ Era Studio Lviv\n\n📍 Хуторівка, 40а, Львів, 79000\n🌐 Instagram: <a href="https://www.instagram.com/era.studio.lviv/">@era.studio.lviv</a>\n\n💳 Оплата через LiqPay`,
        parse_mode: 'HTML',
      })
    })
    // Debug: what the bot sees about me. Maintainer only; for anyone else the command doesn't exist.
    this.composer.command('me', (ctx, next) => (UserHelper.isMaintainerRole(ctx) ? this.meHandler(ctx) : next()))

    this.composer.command('help', (ctx) => {
      return ctx.replyWithHTML(`<b>❓ Як користуватися ботом</b>

<b>🔹 Якщо ти клієнт:</b>
- <i>Зареєструйся</i>
- Очікуй <i>верифікацію адміном</i>
- Користуйся всіма можливостями <i>бота</i>!

<b>🔹 Якщо ти тренер:</b>
- Відправ запит на <i>верифікацію тренера</i>

⚠️ <u>Бот доступний тільки для клієнтів та тренерів нашої студії</u> 

🔧 <b>Бот глючить?</b>
Спробуй команду /start — зазвичай це вирішує проблему! Не спрацювало? Питай у тренера чи адміна 💬`)
    })
  }

  /** `/me`: the person (auth cache), the acting child, children and parents, passes, scene. */
  private meHandler = async (ctx: BotContext) => {
    const user = UserHelper.getUser(ctx)
    const esc = (v: unknown) => TextHelper.escapeHtml(String(v ?? '—'))
    const passes = (client: { id: string; pass: { id: string; status: string; groupId: number | null }[] } | null | undefined) =>
      client ? `client ${esc(client.id)}\n` + (client.pass.map((p) => `  • ${esc(p.id.slice(0, 8))} ${esc(p.status)} group=${esc(p.groupId)}`).join('\n') || '  (no passes)') : 'client —'
    const [children, parents] = await Promise.all([
      this.userProfileService.findChildren(user.id),
      this.userProfileService.findGuardians(user.id),
    ])

    const lines = [
      `<b>👤 Я</b> ${esc(user.fullName)}`,
      `id ${esc(user.id)}`,
      `role ${esc(user.role)} · status ${esc(user.status)} · tg ${esc(user.telegramId)}`,
      `rules consent ${esc(user.consentToRules)} · trial ${esc(user.trial_discount)}`,
      passes(user.client),
      `hasChildren (menu) ${esc(UserHelper.hasChildren(user))} · actingProfileId ${esc(user.actingProfileId)}`,
    ]
    if (UserHelper.isActingForChild(ctx)) {
      const child = UserHelper.getActingUser(ctx)
      lines.push(
        '',
        `<b>🧒 Дію за</b> ${esc(child.fullName)}`,
        `id ${esc(child.id)} · status ${esc(child.status)} · dob ${esc(child.dateOfBirth)}`,
        `rules consent ${esc(child.consentToRules)}`,
        passes(child.client),
      )
    } else {
      lines.push('', '<b>🧒 Дію за</b> себе')
    }
    lines.push('', `<b>👨‍👩‍👧 Діти (${children.length})</b>`, ...children.map((c) => `  • ${esc(c.fullName)} · ${esc(c.status)} · ${esc(c.id.slice(0, 8))}`))
    if (parents.length) {
      lines.push('', `<b>Батьки (${parents.length})</b>`, ...parents.map((p) => `  • ${esc(p.fullName)} · ${esc(p.status)}`))
    }
    lines.push('', `scene ${esc(ctx.session?.__scenes?.current)} · studio ${esc(this.typedConfigService.getStudioId())}`)
    return ctx.replyWithHTML(lines.join('\n'))
  }
}
