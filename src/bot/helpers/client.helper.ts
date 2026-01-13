import { BotContext } from '../bot.context'
import { AdminKeyboards } from '../keyboard/storage'
import { UserProfileWithClient } from '../libs'
import { BotHelper } from './bot.helper'
import { MessageHelper } from './message.helper'
import { UserHelper } from './user.helper'

export class ClientHelper {
  static async renderClientManageMenu(ctx: BotContext, clientUserProfile: UserProfileWithClient, shouldEdit = true) {
    const isArchived = UserHelper.isArchivedProfile(clientUserProfile)
    const message = MessageHelper.getClientManageHeaderMessage(clientUserProfile)

    if (shouldEdit) {
      return BotHelper.safeEditMessageText(ctx, message, AdminKeyboards.clientManageMenu(clientUserProfile.id, isArchived))
    } else {
      return ctx.replyWithHTML(message, AdminKeyboards.clientManageMenu(clientUserProfile.id, isArchived))
    }
  }
}
