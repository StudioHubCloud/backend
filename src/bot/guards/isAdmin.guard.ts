import { BotContext } from '../bot.context'
import { UserHelper } from '../helpers'
import { MESSAGES_COMMON } from '../static/messages'

export const AdmindGuard = async (ctx: BotContext, next: () => Promise<void>) => {
  const isAdmin = UserHelper.isAdminRole(ctx)

  if (isAdmin) {
    return await next()
  }

  return ctx.reply(MESSAGES_COMMON.ACCESS_RESTRICTED)
}