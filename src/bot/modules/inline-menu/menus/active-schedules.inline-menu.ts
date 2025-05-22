import { BotContext } from '@app/bot/bot.context'
import { UserHelper } from '@app/bot/helpers'
import { TrainingSignupService } from '@app/domain/training-signup'
import { API, CALLBACK_PREFIX } from '@app/libs'
import { Injectable } from '@nestjs/common'
import { format } from 'date-fns'
import { Composer } from 'telegraf'

@Injectable()
export class ActiveSchedulesInlineMenu {
  protected readonly composer = new Composer<BotContext>()

  constructor(private readonly trainingSignupService: TrainingSignupService) {
    this.initMenuActions()
  }

  middleware() {
    return this.composer.middleware()
  }

  async initMenu(ctx: BotContext) {
    const { id } = UserHelper.getUser(ctx)
    const activeSignups = await this.trainingSignupService.getClientSignups(id)
    if (!activeSignups.length) {
      return ctx.reply('У вас немає активних записів на тренування')
    }

    const keyboard = activeSignups.map((signup) => [
      {
        text: `➖ ${signup.group.groupStyle.title} (${format(signup.training.date, 'dd.MM.yyyy HH:mm')})`,
        callback_data: `sign-out:${signup.id}`,
      },
    ])
    await ctx.reply('В цьому меню активних записів можна виписатись з тренування ⬇️⬇️')
    return ctx.reply('Ваші активні записи:', {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    })
  }

  private initMenuActions() {
    const regexp = new RegExp(`^sign-out:(.*)$`)

    this.composer.action(regexp, async (ctx) => {
      const signupId = ctx.match[1]
      const { id } = UserHelper.getUser(ctx)

      const response = await this.trainingSignupService.signOutFromTrainingAsClientViaTelegram(signupId)
      
      const activeSignups = await this.trainingSignupService.getClientSignups(id)

      if (response.status === API.RESPONSE.ERROR_STRING) {
        return ctx.answerCbQuery(response.message, { show_alert: true })
      }

      if (!activeSignups.length) {
        return ctx.editMessageText('У вас немає активних записів на тренування')
      }

      const keyboard = activeSignups.map((signup) => [
        {
          text: `➖ ${signup.group.groupStyle.title} (${format(signup.training.date, 'dd.MM.yyyy HH:mm')})`,
          callback_data: `sign-out:${signup.id}`,
        },
      ])
      await ctx.answerCbQuery(response.message, { show_alert: true })
      return ctx.editMessageText('Ваші активні записи:', {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      })
    })
  }
}
