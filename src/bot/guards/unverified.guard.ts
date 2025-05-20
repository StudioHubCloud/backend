import { BotContext } from '../bot.context'
import { KeyboardHelper, UserHelper } from '../helpers'
import { KEYBARODS_COMMON } from '../static/keyboards'
import { MESSAGES_COMMON } from '../static/messages'

export const UnverifiedGuard = async (ctx: BotContext, next: () => Promise<void>) => {
  const needVerification = UserHelper.needVerification(ctx)

  if (!needVerification) {
    return await next()
  }

  const isVerificationRequested = UserHelper.isVerificatonRequestedStatus(ctx)
  if (isVerificationRequested) {
    return ctx.reply(MESSAGES_COMMON.VERIFICATION_REQUESTED)
  }

  const keyboard = KeyboardHelper.createReplyMarkupKeyboard(KEYBARODS_COMMON.REGISTER_AS)

  return ctx.reply(MESSAGES_COMMON.GREETING, keyboard)
}
