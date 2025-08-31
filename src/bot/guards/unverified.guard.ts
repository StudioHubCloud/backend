import { BotContext } from '../bot.context'
import { UserHelper } from '../helpers'
import { CommonKeyboards } from '../keyboard/storage'
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

  return ctx.reply(MESSAGES_COMMON.GREETING, CommonKeyboards.registerAs())
}
