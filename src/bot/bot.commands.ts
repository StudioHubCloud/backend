import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'
import { BotContext } from './bot.context'
import { ERA_STUDIO_LOGO_320 } from './libs'

@Injectable()
export class BotCommands {
  private readonly composer: Composer<BotContext>
  constructor() {
    this.composer = new Composer<BotContext>()
    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initComposerHandlers() {
    this.composer.on('photo', async (ctx, next) => {
      console.log(ctx.update.message.photo)
      await next()
    })

    //add schedule commant with screenshots of current schedule
    this.composer.command('start', async (ctx, next) => {
      if (ctx.scene) {
        await ctx.scene.leave()
      }
      await next()
    })

    this.composer.command('info', (ctx) => {
      return ctx.replyWithPhoto(ERA_STUDIO_LOGO_320, {
        caption: `⭐ Era Studio Lviv\n\n📍 Хуторівка, 40а, Львів, 79000\n🌐 Instagram: <a href="https://www.instagram.com/era.studio.lviv/">@era.studio.lviv</a>\n\n💳 Оплата через LiqPay`,
        parse_mode: 'HTML',
      })
    })
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
}
