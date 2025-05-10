import { SCENES } from '@app/libs'
import { BotContext } from '../bot.context'
import { UserHelper } from '../helpers'
import { MESSAGES_COMMON } from '../static/messages'

export const UnverifiedGuard = async (ctx: BotContext, next: () => Promise<void>) => {
  const isUnverified = UserHelper.isUnverifiedStatus(ctx)

  if (!isUnverified) {
    return await next()
  }
  
  const isVerificationRequested = UserHelper.isVerificatonRequestedStatus(ctx)

  if (isVerificationRequested) {
    return ctx.reply(MESSAGES_COMMON.VERIFICATION_REQUESTED)
  }

  const role = UserHelper.getUserRole(ctx)

  return ctx.scene.enter(SCENES.VERIFICATION_REQUEST, { role })
}