import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { UserProfileService } from '@app/domain/user-profile'
import { UserProfileRoleEnum } from '@app/libs'
import { KeyboardHelper, UserHelper } from '@app/bot/helpers'
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram'
import { CommonKeyboards } from '@app/bot/keyboard/storage'
import { MessageHelper } from '@app/bot/helpers/message.helper'

@Injectable()
export class VerificationInlineMenu {
  protected readonly composer = new Composer<BotContext>()

  constructor(private readonly userProfileService: UserProfileService) {
    this.initMenuActions()
  }

  middleware() {
    return this.composer.middleware()
  }

  async initMenu(ctx: BotContext) {
    const userProfiles = await this.userProfileService.getVerificationRequestedUsers()

    const result: Record<UserProfileRoleEnum.CLIENT | UserProfileRoleEnum.TRAINER, InlineKeyboardButton[][]> = {
      [UserProfileRoleEnum.CLIENT]: [],
      [UserProfileRoleEnum.TRAINER]: [],
    }

    userProfiles.forEach((user) => {
      if (user.role === UserProfileRoleEnum.CLIENT || user.role === UserProfileRoleEnum.TRAINER) {
        result[user.role].push([
          { text: `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`, callback_data: `verify:${user.id}` },
        ])
      }
    })

    if (!userProfiles.length) {
      return ctx.reply('Немає активних запитів на підтвердження')
    }

    Object.keys(result).forEach(async (key) => {
      const role = key as UserProfileRoleEnum
      const buttons = result[role]
      if (buttons.length > 0) {
        const keyboard = KeyboardHelper.createInlineKeyboard(buttons)
        const message = `Активні запити на підтвердження ${UserHelper.isClientRole(role) ? 'клієнтів' : 'тренерів'}`
        await ctx.reply(message, keyboard)
      }
    })
  }

  private initMenuActions() {
    const regexp = new RegExp(`^verify:(.*)$`)

    this.composer.action(regexp, async (ctx) => {
      const userId = ctx.match[1]
      const { dateOfBirth, firstName, lastName, phoneNumber, role, id } = await this.userProfileService.getUserProfileById(userId)
      return ctx.editMessageText(
        MessageHelper.getVerifyRequestMessage(
          { date_of_birth: dateOfBirth ?? '', firstName, lastName: lastName ?? '', phone: phoneNumber ?? '' },
          { completed: true, role },
        ),
        {
          parse_mode: 'HTML',
          ...CommonKeyboards.verifyActions(id, role),
        },
      )
    })
  }
}
