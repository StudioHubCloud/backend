import { BotContext } from '../bot.context'
import { UserHelper } from '../helpers'
import { MESSAGES_COMMON } from '../static/messages'

export const IsBlockedGuard = async (ctx: BotContext, next: () => Promise<void>) => {
  const isBlocked = UserHelper.isBlockedStatus(ctx)

  if (!isBlocked) {
    return await next()
  }

  return ctx.reply(MESSAGES_COMMON.ACCESS_RESTRICTED)
}