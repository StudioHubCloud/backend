import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { SCENES, TReplyMarkupKeyboard } from '@app/bot/libs'
import { SceneHelper, BotHelper, TextHelper, UserHelper, KeyboardHelper } from '@app/bot/helpers'
import { MESSAGES_COMMON, MESSAGES_SCENE } from '@app/bot/static/messages'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { InitiatePayoutSceneKeyboards } from '@app/bot/keyboard/storage/scene-keyboards'
import { DATE_FORMAT } from '@app/libs'
import { IInitiatePayoutSceneState, InitiatePayoutSceneHelper } from './initiate-payout.scene-helper'
import { UserProfileService } from '@app/domain/user-profile'
import { TypedConfigService } from '@app/infrastructure/config'
import { StaffMemberPayoutService } from '@app/domain/staff-member-payout'

@Injectable()
export class InitiatePayoutScene extends Scenes.WizardScene<BotContext> {
  private readonly initiatePayoutScene = new SceneHelper<IInitiatePayoutSceneState>()
  private exitKeyboard: TReplyMarkupKeyboard

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly staffMemberPayoutService: StaffMemberPayoutService,
    private readonly userProfileService: UserProfileService,
    private readonly configService: TypedConfigService,
  ) {
    super(
      SCENES.INITIATE_PAYOUT,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.payoutDateHandler(ctx),
      (ctx) => this.confirmPayoutHandler(ctx),
    )

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      await ctx.replyWithHTML(MESSAGES_SCENE.INITIATE_PAYOUT.EXIT, this.exitKeyboard)
      return ctx.scene.leave()
    })

    this.enter(async (ctx, next) => {
      const { staffUserId } = this.initiatePayoutScene.getState(ctx)

      const { role } = UserHelper.getUser(ctx)
      const keyboard = KeyboardHelper.getRoleBasedMainMenuKeyboard(role)
      this.exitKeyboard = keyboard

      if (!staffUserId) {
        ctx.replyWithHTML(MESSAGES_SCENE.INITIATE_PAYOUT.ERROR_NO_STAFF_ID, keyboard)
        return ctx.scene.leave()
      }

      const staffUserProfile = await this.userProfileService.getUserProfileById(staffUserId)

      if (!staffUserProfile) {
        ctx.replyWithHTML(MESSAGES_SCENE.INITIATE_PAYOUT.ERROR_NO_STAFF_PROFILE, keyboard)
        return ctx.scene.leave()
      }

      this.initiatePayoutScene.setState(ctx, { staffUserProfile })
      return await next()
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    const todayDateString = this.getTodayDateString()
    await ctx.replyWithHTML(
      MESSAGES_SCENE.INITIATE_PAYOUT.ENTER_PAYOUT_DATE,
      InitiatePayoutSceneKeyboards.enterPayoutDateKeyboard(todayDateString),
    )
    return ctx.wizard.next()
  }

  private payoutDateHandler = async (ctx: BotContext) => {
    try {
      const { textPayload } = BotHelper.getUpdatePayload(ctx)

      const payoutDate = TextHelper.validateDateInput(textPayload)

      if (!payoutDate) {
        return ctx.replyWithHTML(MESSAGES_COMMON.DATE_ERROR)
      }

      this.initiatePayoutScene.setState(ctx, { payoutDate })
      const state = this.initiatePayoutScene.getStateAll(ctx)

      const salaryResult = await this.staffMemberPayoutService.calculateStaffPayoutSalary(state.staffUserId, state.payoutDate)

      if (!salaryResult) {
        await ctx.replyWithHTML(MESSAGES_SCENE.INITIATE_PAYOUT.ERROR_PAYOUT_CALCULATION, this.exitKeyboard)
        return ctx.scene.leave()
      }
      this.initiatePayoutScene.setState(ctx, {
        payoutAmount: salaryResult.statistics.totalPayout,
        trainingIds: salaryResult.trainingIds,
      })

      await ctx.replyWithHTML(
        InitiatePayoutSceneHelper.getConfirmPayoutMessage({ ...state, payoutAmount: salaryResult.statistics.totalPayout }),
        InitiatePayoutSceneKeyboards.confirmPayoutKeyboard(),
      )
      return ctx.wizard.next()
    } catch (error) {
      await this.handleError(ctx, error)
    }
  }

  private confirmPayoutHandler = async (ctx: BotContext) => {
    try {
      const { textPayload } = BotHelper.getUpdatePayload(ctx)

      switch (textPayload) {
        case BUTTON_PATTERNS.BACK:
          const todayDateString = this.getTodayDateString()
          await ctx.replyWithHTML(
            MESSAGES_SCENE.INITIATE_PAYOUT.ENTER_PAYOUT_DATE,
            InitiatePayoutSceneKeyboards.enterPayoutDateKeyboard(todayDateString),
          )
          return ctx.wizard.back()

        default:
          break
      }

      if (textPayload !== BUTTON_PATTERNS.CONFIRM) {
        return
      }

      const state = this.initiatePayoutScene.getState(ctx)
      const { payoutAmount, payoutDate, staffUserId, trainingIds } = state
      const payoutDescription = InitiatePayoutSceneHelper.getPayoutDescriptionMessage(state)

      const result = await this.staffMemberPayoutService.initiateStaffPayout({
        amount: String(payoutAmount),
        staffUserId: staffUserId,
        paidAt: payoutDate,
        description: payoutDescription,
        trainingIds,
      })

      if (!result) {
        await ctx.replyWithHTML(MESSAGES_SCENE.INITIATE_PAYOUT.ERROR_PAYOUT_REGISTER, this.exitKeyboard)
      }

      const staffMessage = InitiatePayoutSceneHelper.getStaffInfoMessage(state)

      await Promise.all([
        BotHelper.safeSendMessage(ctx.telegram, state.staffUserProfile.telegramId, staffMessage),
        ctx.replyWithHTML(MESSAGES_SCENE.INITIATE_PAYOUT.REGISTER_SUCCESS, this.exitKeyboard),
      ])
      return ctx.scene.leave()
    } catch (error) {
      if (error?.message?.includes('duplicate key')) {
        await ctx.replyWithHTML(MESSAGES_SCENE.INITIATE_PAYOUT.PAYOUT_ALREADY_REGISTERED, this.exitKeyboard)
        return ctx.scene.leave()
      }
      await this.handleError(ctx, error)
    }
  }

  private async handleError(ctx: BotContext, error: any) {
    await BotHelper.safeSendMessage(
      ctx.telegram,
      this.configService.get('MAINTAINER_CHAT_ID'),
      `Error: ${error?.message}\n\nUpdate: ${JSON.stringify(ctx.update)}`,
    )
    await ctx.replyWithHTML(
      `❌ Виникла помилка: ${error?.message}. Спробуйте ще раз або зверніться до адміністратора.`,
      this.exitKeyboard,
    )
    return ctx.scene.leave()
  }

  private getTodayDateString() {
    return this.dateTimeProvider.formatDateStringInTz(new Date().toISOString(), DATE_FORMAT.DATE_INPUT)
  }
}
