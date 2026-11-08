import { BotContext } from '../bot.context'
import { AdminKeyboards } from '../keyboard/storage'
import { UserProfileWithClient } from '../libs'
import { BotHelper } from './bot.helper'
import { MessageHelper } from './message.helper'
import { UserHelper } from './user.helper'

export class ClientHelper {
  static async renderClientManageMenu(
    ctx: BotContext,
    clientUserProfile: UserProfileWithClient,
    shouldEdit = true,
    family?: Parameters<typeof MessageHelper.getFamilyLines>[0],
  ) {
    const isArchived = UserHelper.isArchivedProfile(clientUserProfile)
    const familyLines = family ? MessageHelper.getFamilyLines(family) : ''
    const message = MessageHelper.getClientManageHeaderMessage(clientUserProfile) + (familyLines ? `\n\n${familyLines}` : '')

    if (shouldEdit) {
      return BotHelper.safeEditMessageText(ctx, message, AdminKeyboards.clientManageMenu(clientUserProfile.id, isArchived))
    } else {
      return ctx.replyWithHTML(message, AdminKeyboards.clientManageMenu(clientUserProfile.id, isArchived))
    }
  }
}
