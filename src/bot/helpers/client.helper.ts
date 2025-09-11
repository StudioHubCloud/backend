import { BotContext } from '../bot.context'
import { AdminKeyboards } from '../keyboard/storage'
import { UserProfileWithClient } from '../libs'
import { MessageHelper } from './message.helper'
import { UserHelper } from './user.helper'

export class ClientHelper {
  static async renderClientManageMenu(ctx: BotContext, clientUserProfile: UserProfileWithClient, shouldEdit = true) {
    const isArchived = UserHelper.isArchivedProfile(clientUserProfile)
    const message = MessageHelper.getClientManageHeaderMessage(clientUserProfile)

    if (shouldEdit) {
      return ctx.editMessageText(message, {
        ...AdminKeyboards.clientManageMenu(clientUserProfile.id, isArchived),
        parse_mode: 'HTML',
      })
    } else {
      return ctx.replyWithHTML(message, AdminKeyboards.clientManageMenu(clientUserProfile.id, isArchived))
    }
  }
}
