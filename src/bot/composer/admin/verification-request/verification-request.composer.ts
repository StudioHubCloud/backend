import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { BotHelper, KeyboardHelper, ParentHelper, PassHelper, RegexHelper } from '@app/bot/helpers'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { PassActivationRequestsInlineMenu, VerificationInlineMenu } from '@app/bot/menus'
import { CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { UserProfileService } from '@app/domain/user-profile'
import { ClientKeyboards, CommonKeyboards, TrainerKeyboards } from '@app/bot/keyboard/storage'
import {
  AuditLogActions,
  AuditLogTrigger,
  PassGroupModeEnum,
  PassStatusEnum,
  PassTemplateTypeEnum,
  UserProfileRoleEnum,
  UserProfileStatusEnum,
} from '@app/libs'
import { UserProfileSelectModel } from '@app/infrastructure/database'
import { MESSAGES_STAFF } from '@app/bot/static/messages'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { PassActivationRequestService } from '@app/domain/pass-activation-request'
import { PassService } from '@app/domain/pass'
import { GroupService } from '@app/domain/group'
import { AdminKeyboards } from '@app/bot/keyboard/storage/admin-keyboards'
import { AuditLogHelper } from '@app/bot/helpers/audit-log.helper'

@Injectable()
export class VerificationRequestComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    private readonly verificationRequestMenu: VerificationInlineMenu,
    private readonly passActivationRequestMenu: PassActivationRequestsInlineMenu,
    private readonly userProfileService: UserProfileService,
    private readonly passActivationRequestService: PassActivationRequestService,
    private readonly passService: PassService,
    private readonly groupService: GroupService,
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
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.USER.PASS_PAYMENT_CONFIRM),
      this.handleConfirmPassPaymentRequest,
    )
    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.USER.PASS_PAYMENT_REJECT),
      this.handleRejectPassActivationRequest,
    )
    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.USER.PASS_PAYMENT_GROUP), this.handleRequestGroupList)
    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.USER.PASS_PAYMENT_GROUP_SELECT),
      this.handleRequestGroupSelect,
    )
    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.USER.PASS_PAYMENT_GROUP_BACK),
      this.handleRequestGroupBack,
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
        await ctx.scene.enter(SCENES.VERIFY_CLIENT, { userProfile })
        BotHelper.safeAnswerCbQuery(ctx)
        BotHelper.safeDeleteMessage(ctx)
        return
      }
      if (userProfile.role === UserProfileRoleEnum.TRAINER) {
        const result = await this.userProfileService.verifyTrainer(userProfile.id)

        if (!result) {
          await BotHelper.safeAnswerCbQuery(ctx, 'Цей користувач не є тренером або він вже верифікований ⚠️', { show_alert: true })
          return
        }

        if (userProfile.telegramId) {
          await BotHelper.safeSendMessage(ctx.telegram, userProfile.telegramId, MESSAGES_STAFF.VERIFY_SUCCESS, TrainerKeyboards.mainMenu())
        }
        await BotHelper.safeAnswerCbQuery(ctx, 'Тренер успішно верифікований ✅', { show_alert: true })
        BotHelper.safeDeleteMessage(ctx)
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

      await ParentHelper.notifyVerified(ctx.telegram, this.userProfileService, userProfile, {
        text: MessageHelper.getClientWithoutPassVerifySuccess(userProfile.firstName),
        extra: ClientKeyboards.mainMenu(),
      })

      await BotHelper.safeAnswerCbQuery(ctx, 'Клієнт успішно верифікований ✅', { show_alert: true })
      BotHelper.safeDeleteMessage(ctx)
      return
    })
  }

  //todo: add are you sure?
  private rejectUserVerifyAction = async (ctx: BotContext) => {
    await this.handleVerifyUserProfileAction(ctx, async (userProfile) => {
      await this.userProfileService.rejectVerificationRequest(userProfile.id)
      await Promise.all([
        ParentHelper.notifyRejected(ctx.telegram, this.userProfileService, userProfile, {
          text: `Ваша заявка на підтвердження була відхилена ❌`,
          extra: CommonKeyboards.registerAs(),
          guardianText: MessageHelper.getParentChildRejected(userProfile.fullName),
        }),
        BotHelper.safeAnswerCbQuery(ctx, 'Ви відхилили запит на реєстрацію ❌'),
      ])
      await BotHelper.safeDeleteMessage(ctx)
    })
  }

  //todo: add are you sure?
  private blockUserAction = async (ctx: BotContext) => {
    await this.handleVerifyUserProfileAction(ctx, async (userProfile) => {
      await this.userProfileService.rejectVerificationRequestAndBlockUser(userProfile.id)
      await Promise.all([
        ParentHelper.notifyRejected(ctx.telegram, this.userProfileService, userProfile, {
          text: `Доступ до боту було обмежено 🚫`,
          extra: KeyboardHelper.removeReplyMarkupKeyboard(),
          guardianText: MessageHelper.getParentChildBlocked(userProfile.fullName),
        }),
        BotHelper.safeAnswerCbQuery(ctx, 'Ви заблокували користувача 🚫'),
      ])
      await BotHelper.safeDeleteMessage(ctx)
    })
  }

  private handleConfirmPassPaymentRequest = async (ctx: BotContext) => {
    return this.handleActivatePassAction(ctx, async (passActivateRequest) => {
      const [success, logOperations] = await this.passService.acceptPassActivateRequest(
        passActivateRequest!.passId,
        passActivateRequest!.id,
      )

      if (!success) {
        await BotHelper.safeAnswerCbQuery(ctx, 'Не вдалося активувати абонемент ❌', { show_alert: true })
        return BotHelper.safeDeleteMessage(ctx)
      }
      BotHelper.safeAnswerCbQuery(ctx, 'Абонемент успішно активовано ✅', { show_alert: true })
      AuditLogHelper.startAction(ctx, AuditLogActions.PASS_ACTIVATE_CONFIRM, AuditLogTrigger.ADMIN_ACTION, logOperations)

      await Promise.all([
        BotHelper.safeDeleteMessage(ctx),
        BotHelper.notifyClient(ctx.telegram, this.userProfileService, passActivateRequest!.client.userProfile, {
          text:
            `✅ Оплату за абонемент <b>${passActivateRequest!.pass.passTemplate.name}</b> підтверджено!\n` +
            // The group may have been changed by the admin: the client sees where the pass works
            PassHelper.getGroupLine(
              { type: passActivateRequest!.pass.passTemplate.type, groupMode: passActivateRequest!.pass.groupMode },
              passActivateRequest!.pass.group?.name,
              { forClient: true },
            ) +
            `\n${PassHelper.getActivationInfo(passActivateRequest!.pass.passTemplate)}`,
          extra: { ...ClientKeyboards.mainMenu({ parent: await this.userProfileService.getParentMenu(passActivateRequest!.client.userProfile.id) }) },
        }),
      ])
    })
  }

  private handleRejectPassActivationRequest = async (ctx: BotContext) => {
    return this.handleActivatePassAction(ctx, async (passActivateRequest) => {
      const [success, logOperations] = await this.passService.rejectPassActivateRequest(passActivateRequest!.pass.id)

      if (!success) {
        await BotHelper.safeAnswerCbQuery(ctx, 'Не вдалося відхилити запит ❌', { show_alert: true })
        return BotHelper.safeDeleteMessage(ctx)
      }
      BotHelper.safeAnswerCbQuery(ctx, 'Запит на активацію абонементу відхилено 🚫', { show_alert: true })
      AuditLogHelper.startAction(ctx, AuditLogActions.PASS_ACTIVATE_REJECT, AuditLogTrigger.ADMIN_ACTION, logOperations)

      await Promise.all([
        BotHelper.safeDeleteMessage(ctx),
        BotHelper.notifyClient(ctx.telegram, this.userProfileService, passActivateRequest!.client.userProfile, {
          text: `🚫 Ваш запит на активацію абонементу <b>${passActivateRequest!.pass.passTemplate.name}</b> було відхилено адміністратором.`,
          extra: {
            ...ClientKeyboards.mainMenu({ parent: await this.userProfileService.getParentMenu(passActivateRequest!.client.userProfile.id) }),
            parse_mode: 'HTML',
          },
        }),
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
      return BotHelper.safeDeleteMessage(ctx)
    }

    await action(userProfile)
  }

  /** "👯‍♀️ Змінити групу" on a request for a FIXED group pass: groups for the client's age, the client's pick first. */
  private handleRequestGroupList = async (ctx: BotContext) => {
    return this.handleActivatePassAction(ctx, async (request) => {
      if (!this.isFixedGroupRequest(request)) {
        return BotHelper.safeAnswerCbQuery(ctx, '⚠️ Групу можна змінити лише для абонемента однієї групи', { show_alert: true })
      }

      const { groups } = await this.groupService.getGroupsForClientPass(request!.client.userProfile.dateOfBirth ?? null)
      await BotHelper.safeAnswerCbQuery(ctx)
      return BotHelper.safeEditMessageReplyMarkup(
        ctx,
        AdminKeyboards.passRequestGroupSelect(request!.id, groups, request!.pass.groupId).reply_markup,
      )
    })
  }

  /** The admin's pick replaces the client's (the pass is still requested); the caption and buttons are refreshed. */
  private handleRequestGroupSelect = async (ctx: BotContext) => {
    return this.handleActivatePassAction(ctx, async (request) => {
      const [, groupId] = RegexHelper.getMatchGroupValue(ctx)
      const { groups } = await this.groupService.getGroupsForClientPass(request!.client.userProfile.dateOfBirth ?? null)
      const group = groups.find((g) => g.id === Number(groupId))

      if (!this.isFixedGroupRequest(request) || !group) {
        return BotHelper.safeAnswerCbQuery(ctx, '⚠️ Цю групу не можна обрати, оновіть запит', { show_alert: true })
      }

      const [, logOperations] = await this.passService.updatePass(request!.pass.id, { groupId: group.id })
      AuditLogHelper.startAction(ctx, AuditLogActions.PASS_EDIT, AuditLogTrigger.ADMIN_ACTION, logOperations)
      await BotHelper.safeAnswerCbQuery(ctx, `👯‍♀️ Група: ${group.name}`)

      const caption = MessageHelper.getClientPassPaymentRequestMessage(
        request!.client.userProfile,
        request!.pass.passTemplate,
        request!.type,
        group.name,
      )
      return ctx
        .editMessageCaption(caption, {
          parse_mode: 'HTML',
          ...AdminKeyboards.verifyPassActions(request!.id, { withGroupChange: true }),
        })
        .catch(() => BotHelper.safeEditMessageReplyMarkup(ctx, AdminKeyboards.verifyPassActions(request!.id, { withGroupChange: true }).reply_markup))
    })
  }

  private handleRequestGroupBack = async (ctx: BotContext) => {
    return this.handleActivatePassAction(ctx, async (request) => {
      await BotHelper.safeAnswerCbQuery(ctx)
      return BotHelper.safeEditMessageReplyMarkup(
        ctx,
        AdminKeyboards.verifyPassActions(request!.id, { withGroupChange: this.isFixedGroupRequest(request) }).reply_markup,
      )
    })
  }

  private isFixedGroupRequest(request: Awaited<ReturnType<typeof this.passActivationRequestService.findById>>): boolean {
    return (
      !!request &&
      request.pass.status === PassStatusEnum.REQUESTED &&
      request.pass.passTemplate.type === PassTemplateTypeEnum.GROUP &&
      request.pass.groupMode === PassGroupModeEnum.FIXED
    )
  }

  private async handleActivatePassAction(
    ctx: BotContext,
    action: (passActivateRequest: Awaited<ReturnType<typeof this.passActivationRequestService.findById>>) => Promise<any>,
  ): Promise<void | boolean> {
    const [_, id] = ctx['match']

    const passActivateRequest = await this.passActivationRequestService.findById(id)

    if (!passActivateRequest) {
      await BotHelper.safeAnswerCbQuery(ctx, '⚠️ Цей запит більше недоступний або був оброблений', { show_alert: true })
      return BotHelper.safeDeleteMessage(ctx)
    }

    await action(passActivateRequest)
  }
}
