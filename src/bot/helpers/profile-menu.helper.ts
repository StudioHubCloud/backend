import { BotContext } from '../bot.context'
import { UserHelper } from './user.helper'

/**
 * Inline messages a parent opened in a profile context («👤 Профіль: Я» / «🧒 Профіль: Ліля»): any button on them works
 * only while that profile is selected — `MiddlewareService.profileMenuGuardMiddleware` removes them otherwise. Stored in
 * the session per message (JSON, bounded); only for parents, everyone else always acts for themselves.
 */
export class ProfileMenuHelper {
  private static readonly MAX_BOUND_MESSAGES = 30

  static bind(ctx: BotContext, messageId: number | undefined, profileId: string = UserHelper.getActingUser(ctx).id) {
    if (!messageId || !UserHelper.hasChildren(UserHelper.getUser(ctx))) {
      return
    }
    // telegraf's session() starts with an undefined session until it is first assigned
    ctx.session ??= {}
    const bound: Record<string, { profileId: string; at: number }> = {
      ...ctx.session.profileMenus,
      [messageId]: { profileId, at: Date.now() },
    }
    const recent = Object.entries(bound)
      .sort(([, a], [, b]) => b.at - a.at)
      .slice(0, ProfileMenuHelper.MAX_BOUND_MESSAGES)
    ctx.session.profileMenus = Object.fromEntries(recent)
  }

  static getBoundProfileId(ctx: BotContext, messageId: number) {
    return ctx.session?.profileMenus?.[messageId]?.profileId
  }

  static unbind(ctx: BotContext, messageId: number) {
    if (ctx.session?.profileMenus?.[messageId]) {
      const { [messageId]: _removed, ...rest } = ctx.session.profileMenus
      ctx.session.profileMenus = rest
    }
  }
}
