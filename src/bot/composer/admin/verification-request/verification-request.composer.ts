import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { BotHelper, KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { PassActivationRequestsInlineMenu, VerificationInlineMenu } from '@app/bot/menus'
import { CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { UserProfileService } from '@app/domain/user-profile'
import { ClientKeyboards, CommonKeyboards, TrainerKeyboards } from '@app/bot/keyboard/storage'
import { UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { UserProfileSelectModel } from '@app/infrastructure/database'
import { MESSAGES_STAFF } from '@app/bot/static/messages'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { PassActivationRequestService } from '@app/domain/pass-activation-request'
import { PassService } from '@app/domain/pass'

@Injectable()
export class VerificationRequestComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    private readonly verificationRequestMenu: VerificationInlineMenu,
    private readonly passActivationRequestMenu: PassActivationRequestsInlineMenu,
    private readonly userProfileService: UserProfileService,
    private readonly passActivationRequestService: PassActivationRequestService,
    private readonly passService: PassService,
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
    this.composer.use(this.passActivationRequestMenu.middleware())
  }

  private initComposerActions() {
    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.USER.VERIFY_YES), this.handleVerifyWithPass)
    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.USER.VERIFY_WITHOUT_PASS),
      this.handleVerifyWithoutPass,
    )
    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.USER.VERIFY_NO), this.rejectUserVerifyAction)
    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.USER.BLOCK), this.blockUserAction)
    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.USER.PASS_PURCHASE_CONFIRM),
      this.handleConfirmPassActivationRequest,
    )
    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.USER.PASS_PURCHASE_REJECT),
      this.handleRejectPassActivationRequest,
    )
  }

  private initComposerHandlers() {
    this.composer.hears(BUTTON_PATTERNS.REQUESTS, (ctx: BotContext) => {
      return this.verificationRequestMenu.initMenu(ctx)
    })

    this.composer.hears(BUTTON_PATTERNS.PASS_REQUESTS, async (ctx: BotContext) => {
      return this.passActivationRequestMenu.initMenu(ctx)
    })
  }

  private handleVerifyWithPass = async (ctx: BotContext) => {
    await this.handleVerifyUserProfileAction(ctx, async (userProfile) => {
      if (userProfile.role === UserProfileRoleEnum.CLIENT) {
        ctx.scene.enter(SCENES.VERIFY_CLIENT, { userProfile })
        BotHelper.safeAnswerCbQuery(ctx)
        ctx.deleteMessage()
        return
      }
      if (userProfile.role === UserProfileRoleEnum.TRAINER) {
        const result = await this.userProfileService.verifyTrainer(userProfile.id)

        if (!result) {
          await BotHelper.safeAnswerCbQuery(ctx, 'Цей користувач не є тренером або він вже верифікований ⚠️', { show_alert: true })
          return
        }

        await BotHelper.safeSendMessage(ctx, userProfile.telegramId, MESSAGES_STAFF.VERIFY_SUCCESS, TrainerKeyboards.mainMenu())
        await BotHelper.safeAnswerCbQuery(ctx, 'Тренер успішно верифікований ✅', { show_alert: true })
        ctx.deleteMessage()
        return
      }
    })
  }

  private handleVerifyWithoutPass = async (ctx: BotContext) => {
    return await this.handleVerifyUserProfileAction(ctx, async (userProfile) => {
      const result = await this.userProfileService.verifyClientWithoutPass(userProfile.id)
      if (!result) {
        await BotHelper.safeAnswerCbQuery(ctx, 'Цей користувач не є клієнтом, або він вже верифікований ⚠️', { show_alert: true })
        return
      }

      await BotHelper.safeSendMessage(
        ctx,
        userProfile.telegramId,
        MessageHelper.getClientWithoutPassVerifySuccess(userProfile.firstName),
        ClientKeyboards.mainMenu({ withoutPass: true }),
      )

      await BotHelper.safeAnswerCbQuery(ctx, 'Клієнт успішно верифікований ✅', { show_alert: true })
      ctx.deleteMessage()
      return
    })
  }

  //todo: add are you sure?
  private rejectUserVerifyAction = async (ctx: BotContext) => {
    await this.handleVerifyUserProfileAction(ctx, async ({ id, telegramId }) => {
      await this.userProfileService.rejectVerificationRequest(id)
      await Promise.all([
        BotHelper.safeSendMessage(ctx, telegramId, `Ваша заявка на підтвердження була відхилена ❌`, CommonKeyboards.registerAs()),
        BotHelper.safeAnswerCbQuery(ctx, 'Ви відхилили запит на реєстрацію ❌'),
      ])
      await ctx.deleteMessage()
    })
  }

  //todo: add are you sure?
  private blockUserAction = async (ctx: BotContext) => {
    await this.handleVerifyUserProfileAction(ctx, async ({ id, telegramId }) => {
      await this.userProfileService.rejectVerificationRequestAndBlockUser(id)
      await Promise.all([
        BotHelper.safeSendMessage(ctx, telegramId, `Доступ до боту було обмежено 🚫`, KeyboardHelper.removeReplyMarkupKeyboard()),
        BotHelper.safeAnswerCbQuery(ctx, 'Ви заблокували користувача 🚫'),
      ])
      await ctx.deleteMessage()
    })
  }

  private handleConfirmPassActivationRequest = async (ctx: BotContext) => {
    return this.handleActivatePassAction(ctx, async (passActivateRequest) => {
      const result = await this.passService.acceptPassActivateRequest(passActivateRequest!.pass.id, passActivateRequest!.id)

      if (!result) {
        await BotHelper.safeAnswerCbQuery(ctx, 'Не вдалося активувати абонемент ❌', { show_alert: true })
        return ctx.deleteMessage()
      }
      BotHelper.safeAnswerCbQuery(ctx, 'Абонемент успішно активовано ✅', { show_alert: true })

      await Promise.all([
        ctx.deleteMessage(),
        BotHelper.safeSendMessage(
          ctx,
          passActivateRequest!.client.userProfile.telegramId,
          `✅ Оплату за абонемент <b>${passActivateRequest!.pass.passTemplate.name}</b> підтверджено!\n\n Абонемент активується при записі на перше тренування та діятиме <b><u>30 днів</u></b>\n\n<i>Без запису впродовж 7 днів - автоактивація</i> 🔄`,
          { ...ClientKeyboards.mainMenu(), parse_mode: 'HTML' },
        ),
      ])
    })
  }

  private handleRejectPassActivationRequest = async (ctx: BotContext) => {
    return this.handleActivatePassAction(ctx, async (passActivateRequest) => {
      const result = await this.passService.rejectPassActivateRequest(passActivateRequest!.pass.id)

      if (!result) {
        await BotHelper.safeAnswerCbQuery(ctx, 'Не вдалося відхилити запит ❌', { show_alert: true })
        return ctx.deleteMessage()
      }
      BotHelper.safeAnswerCbQuery(ctx, 'Запит на активацію абонементу відхилено 🚫', { show_alert: true })

      await Promise.all([
        ctx.deleteMessage(),
        BotHelper.safeSendMessage(
          ctx,
          passActivateRequest!.client.userProfile.telegramId,
          `🚫 Ваш запит на активацію абонементу <b>${passActivateRequest!.pass.passTemplate.name}</b> було відхилено адміністратором.`,
          { ...ClientKeyboards.mainMenu({ withoutPass: true }), parse_mode: 'HTML' },
        ),
      ])
    })
  }

  private async handleVerifyUserProfileAction(
    ctx: BotContext,
    action: (userProfile: UserProfileSelectModel) => Promise<void>,
  ): Promise<void | boolean> {
    const [_, id] = ctx['match']
    const userProfile = await this.userProfileService.getUserProfileById(id)

    if (userProfile.status !== UserProfileStatusEnum.VERIFICATION_REQUESTED) {
      await BotHelper.safeAnswerCbQuery(ctx, 'Запит на підтвердження цього користувача не актуальний ⏰', { show_alert: true })
      return ctx.deleteMessage()
    }

    await action(userProfile)
  }

  private async handleActivatePassAction(
    ctx: BotContext,
    action: (passActivateRequest: Awaited<ReturnType<typeof this.passActivationRequestService.findById>>) => Promise<any>,
  ): Promise<void | boolean> {
    const [_, id] = ctx['match']

    const passActivateRequest = await this.passActivationRequestService.findById(id)

    if (!passActivateRequest) {
      await BotHelper.safeAnswerCbQuery(ctx, '⚠️ Цей запит більше недоступний або був оброблений', { show_alert: true })
      return ctx.deleteMessage()
    }

    await action(passActivateRequest)
  }
}
