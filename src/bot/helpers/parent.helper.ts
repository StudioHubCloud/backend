import { Telegram } from 'telegraf'
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types'
import { UserProfileRoleEnum } from '@app/libs'
import type { UserProfileService } from '@app/domain/user-profile'
import { UserProfileSelectModel } from '@app/infrastructure/database'
import { CommonKeyboards } from '../keyboard/storage'
import { BotHelper } from './bot.helper'
import { KeyboardHelper } from './keyboard.helper'
import { MessageHelper } from './message.helper'

type TProfile = Pick<UserProfileSelectModel, 'id' | 'telegramId' | 'fullName' | 'firstName'>

/** Parents ("Мої діти") around the admin's decision on a client request: one approval for a parent + child. */
export class ParentHelper {
  /**
   * After the admin approved a client profile. Parents who registered together with this child become clients acting for
   * it and get the client menu with «🧒 Профіль: <child>»; then the approval goes to the profile's recipients (parents:
   * an impersonal text about the child).
   */
  static async notifyVerified(
    telegram: Telegram,
    userProfileService: UserProfileService,
    profile: TProfile,
    message: { text: string; extra?: ExtraReplyMessage },
  ) {
    const activated = await userProfileService.activatePendingGuardians(profile.id)
    await Promise.all(
      activated.map((parent) =>
        parent.telegramId
          ? BotHelper.safeSendMessage(
              telegram,
              parent.telegramId,
              MessageHelper.makeClientGreetingsMessage(parent.firstName),
              KeyboardHelper.getRoleBasedMainMenuKeyboard(UserProfileRoleEnum.CLIENT, { parent: { actingName: profile.firstName } }),
            )
          : null,
      ),
    )
    return BotHelper.notifyClient(telegram, userProfileService, profile, {
      ...message,
      guardianText: MessageHelper.getParentChildVerified(profile.fullName),
    })
  }

  /**
   * After the admin rejected (or blocked) a client request. Parents still waiting with this child go back to the start
   * screen (they get the registration keyboard); the other parents just get the text about the child.
   */
  static async notifyRejected(
    telegram: Telegram,
    userProfileService: UserProfileService,
    profile: TProfile,
    message: { text: string; extra?: ExtraReplyMessage; guardianText: string },
  ) {
    const rejected = await userProfileService.rejectPendingGuardians(profile.id)
    const rejectedChats = new Set(rejected.map((parent) => parent.telegramId).filter(Boolean))
    const recipients = await userProfileService.getNotificationRecipients(profile)

    await Promise.all(
      recipients.map(({ chatId, asGuardian }) => {
        if (!asGuardian) {
          return BotHelper.safeSendMessage(telegram, chatId, message.text, message.extra)
        }
        return BotHelper.safeSendMessage(telegram, chatId, message.guardianText, rejectedChats.has(chatId) ? CommonKeyboards.registerAs() : undefined)
      }),
    )
  }
}
