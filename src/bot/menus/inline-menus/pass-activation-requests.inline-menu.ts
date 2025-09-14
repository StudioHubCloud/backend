import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'

import { BotHelper, KeyboardHelper, PassHelper, RegexHelper, UserHelper } from '@app/bot/helpers'
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram'
import { AdminKeyboards } from '@app/bot/keyboard/storage'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { CALLBACK_PREFIX } from '@app/bot/libs'

import { PassActivationRequestService } from '@app/domain/pass-activation-request'

@Injectable()
export class PassActivationRequestsInlineMenu {
  protected readonly composer = new Composer<BotContext>()

  constructor(
    private readonly passActivationRequestService: PassActivationRequestService,
  ) {
    this.initMenuActions()
  }

  middleware() {
    return this.composer.middleware()
  }

  async initMenu(ctx: BotContext) {
    const passActivationRequests = await this.passActivationRequestService.findAllStudioRequests()

    if (!passActivationRequests.length) {
      return ctx.reply('📝 Немає активних запитів на активацію абонементів')
    }

    const buttons: InlineKeyboardButton[][] = [
      passActivationRequests.map((par) => ({
        text: `${UserHelper.getDisplayName(par.client.userProfile)} | ${par.pass.passTemplate.name} ${PassHelper.toDisplayPrice(par.pass.passTemplate.price)}`,
        callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.USER.ACTIVATE_PASS_REQUESTS, par.id),
      })),
    ]

    const message = `✉️ Активні запити на активацію абонементів: `

    const keyboard = KeyboardHelper.createInlineKeyboard(buttons)
    const keyboardWithClose = KeyboardHelper.addCloseButton(keyboard)

    await ctx.reply(message, keyboardWithClose)
  }

  private initMenuActions() {
    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.USER.ACTIVATE_PASS_REQUESTS), async (ctx) => {
      const [id] = RegexHelper.getMatchGroupValue(ctx)

      if (!id) {
        BotHelper.safeAnswerCbQuery(ctx, '❌ Ідентифікатор запиту не знайдено', { show_alert: true })
        return ctx.deleteMessage()
      }

      const passActivationRequest = await this.passActivationRequestService.findById(id)

      if (!passActivationRequest) {
        BotHelper.safeAnswerCbQuery(ctx, '⚠️ Цей запит більше недоступний або був оброблений', { show_alert: true })
        return ctx.deleteMessage()
      }

      BotHelper.safeAnswerCbQuery(ctx)

      const { fileId, fileType } = passActivationRequest

      try {
        await ctx.editMessageMedia(
          {
            type: fileType,
            media: fileId,
            caption: MessageHelper.getClientPassPurchaseRequestMessage(
              passActivationRequest.client.userProfile,
              passActivationRequest.pass.passTemplate,
            ),
            parse_mode: 'HTML',
          },
          AdminKeyboards.verifyPassPurchaseActions(passActivationRequest.id),
        )
      } catch (error) {
        await ctx.deleteMessage().catch(() => {})
        throw new Error(error)
      }
    })
  }
}
