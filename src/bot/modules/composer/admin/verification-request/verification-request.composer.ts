import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { PATTERNS_ADMIN } from '@app/bot/static/patterns'
import { VerificationInlineMenu } from '@app/bot/modules/inline-menu'
import { CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { UserProfileService } from '@app/domain/user-profile'
import { CommonKeyboards } from '@app/bot/modules/keyboard/storage'
import { UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { UserProfileSelectModel } from '@app/infrastructure/database'

@Injectable()
export class VerificationRequestComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    private readonly verificationRequestMenu: VerificationInlineMenu,
    private readonly userProfileService: UserProfileService,
  ) {
    this.composer = new Composer<BotContext>()

    this.configureMenus()
    this.initComposerActions()
    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  private configureMenus() {
    this.composer.use(this.verificationRequestMenu.middleware())
  }

  private initComposerActions() {
    this.setupAction(CALLBACK_PREFIX.STAFF.USER.VERIFY_YES, this.verifyUserAction)
    this.setupAction(CALLBACK_PREFIX.STAFF.USER.VERIFY_NO, this.rejectUserVerifyAction)
    this.setupAction(CALLBACK_PREFIX.STAFF.USER.BLOCK, this.blockUserAction)
  }

  private initComposerHandlers() {
    this.composer.hears(PATTERNS_ADMIN.REQUESTS, (ctx: BotContext) => {
      return this.verificationRequestMenu.initMenu(ctx)
    })
  }

  private setupAction(prefix: string, action: (ctx: BotContext) => Promise<void>) {
    this.composer.action(RegexHelper.createButtonActionRegex(prefix), action)
  }

  private async handleUserProfileAction(
    ctx: BotContext,
    action: (userProfile: UserProfileSelectModel) => Promise<void>,
  ): Promise<void | boolean> {
    const [_, id] = ctx['match']
    const userProfile = await this.userProfileService.getUserProfileById(id)

    if (userProfile.status !== UserProfileStatusEnum.VERIFICATION_REQUESTED) {
      await ctx.reply('Запит на підтвердження цього користувача не актуальний')
      return ctx.deleteMessage()
    }

    await action(userProfile)
  }

  private verifyUserAction = async (ctx: BotContext) => {
    await this.handleUserProfileAction(ctx, async (userProfile) => {
      if (userProfile.role === UserProfileRoleEnum.CLIENT) {
        ctx.scene.enter(SCENES.VERIFY_CLIENT, { userProfile })
        ctx.deleteMessage()
        return
      }
      if (userProfile.role === UserProfileRoleEnum.TRAINER) {
        ctx.scene.enter(SCENES.VERIFY_TRAINER, { userProfile })
        ctx.deleteMessage()
        return
      }
    })
  }

  //todo: add are you sure?
  private rejectUserVerifyAction = async (ctx: BotContext) => {
    await this.handleUserProfileAction(ctx, async ({ id, telegramId }) => {
      await this.userProfileService.rejectVerificationRequest(id)
      await Promise.all([
        ctx.telegram.sendMessage(telegramId, `Ваша заявка на підтвердження була відхилена.`, CommonKeyboards.registerAs()),
        ctx.reply('Ви відхилили запит на реєстрацію'),
      ])
      await ctx.deleteMessage()
    })
  }

  //todo: add are you sure?
  private blockUserAction = async (ctx: BotContext) => {
    await this.handleUserProfileAction(ctx, async ({ id, telegramId }) => {
      await this.userProfileService.rejectVerificationRequestAndBlockUser(id)
      await Promise.all([
        ctx.telegram.sendMessage(telegramId, `Доступ до боту було обмежено`, KeyboardHelper.removeReplyMarkupKeyboard()),
        ctx.reply('Ви заблокували користувача'),
      ])
      await ctx.deleteMessage()
    })
  }
}
