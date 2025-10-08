import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { CALLBACK_PREFIX, GetGroupByIdResponse, GetTrainingByIdResponse, SCENES, TReplyMarkupKeyboard } from '@app/bot/libs'
import { SceneHelper, BotHelper, UserHelper, KeyboardHelper } from '@app/bot/helpers'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { TypedConfigService } from '@app/infrastructure/config'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { AdminKeyboards, CommonSceneKeyboards } from '@app/bot/keyboard/storage'
import { TrainingService } from '@app/domain/training'
import { GroupService } from '@app/domain/group'
import { TrainingSignupService } from '@app/domain/training-signup'

export interface ISpetialScheduleSceneState {
  trainingId: number
  fromUpcomingTrainingsMenu: boolean
  staffUserId: string
  promptMessageId: number
  fallbackUsername: string
  group: GetGroupByIdResponse
}

@Injectable()
export class SpecialScheduleScene extends Scenes.WizardScene<BotContext> {
  private readonly specialScheduleScene = new SceneHelper<ISpetialScheduleSceneState>()
  private exitKeyboard: TReplyMarkupKeyboard

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly trainingService: TrainingService,
    private readonly trainingSignupService: TrainingSignupService,
    private readonly groupService: GroupService,
    private readonly configService: TypedConfigService,
  ) {
    super(
      SCENES.SPECIAL_SCHEDULE,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.clientNameHandler(ctx),
    )

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      await ctx.replyWithHTML(MESSAGES_SCENE.SPECIAL_SCHEDULE.EXIT, this.exitKeyboard)
      return this.handleSceneExitAndCleanup(ctx)
    })

    this.enter(async (ctx, next) => {
      const { trainingId } = this.specialScheduleScene.getState(ctx)

      const training = await this.trainingService.getTrainingById(+trainingId)
      const role = UserHelper.getUserRole(ctx)
      const keyboard = KeyboardHelper.getRoleBasedMainMenuKeyboard(role)
      this.exitKeyboard = keyboard

      if (!training) {
        ctx.replyWithHTML(MESSAGES_SCENE.SPECIAL_SCHEDULE.NO_TRAINING_FOUND, this.exitKeyboard)
        return this.handleSceneExitAndCleanup(ctx)
      }

      const group = await this.groupService.getGroupById(training.groupId)

      if (!group) {
        ctx.replyWithHTML(MESSAGES_SCENE.SPECIAL_SCHEDULE.NO_GROUP_FOUND, this.exitKeyboard)
        return this.handleSceneExitAndCleanup(ctx)
      }

      this.specialScheduleScene.setState(ctx, { group })

      return await next()
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    const message = await ctx.replyWithHTML(MESSAGES_SCENE.SPECIAL_SCHEDULE.ENTER_CLIENT_NAME, CommonSceneKeyboards.exit())
    this.specialScheduleScene.setState(ctx, { promptMessageId: message.message_id })
    return ctx.wizard.next()
  }

  private clientNameHandler = async (ctx: BotContext) => {
    try {
      const { textPayload } = BotHelper.getUpdatePayload(ctx)
      const { trainingId, group } = this.specialScheduleScene.getState(ctx)

      await this.trainingSignupService.createSpecialScheduleSignup({
        trainingId,
        fallbackUsername: textPayload,
        groupId: group.id,
      })

      await ctx.replyWithHTML(`✅ Запис на ім'я ${textPayload} успішно створено`, this.exitKeyboard)
      return this.handleSceneExitAndCleanup(ctx)
    } catch (error) {
      await this.handleError(ctx, error)
    }
  }

  private async handleError(ctx: BotContext, error: any) {
    await BotHelper.safeSendMessage(
      ctx,
      this.configService.get('MAINTAINER_CHAT_ID'),
      `Error: ${error?.message}\n\nUpdate: ${JSON.stringify(ctx.update)}`,
    )
    await ctx.replyWithHTML(
      `❌ Виникла помилка: ${error?.message}. Спробуйте ще раз або зверніться до адміністратора.`,
      this.exitKeyboard,
    )
    return ctx.scene.leave()
  }

  private handleSceneExitAndCleanup = async (ctx: BotContext) => {
    const { fromUpcomingTrainingsMenu, staffUserId, trainingId, group, promptMessageId } = this.specialScheduleScene.getState(ctx)
    const training = await this.trainingService.getTrainingById(+trainingId)

    const backButtonCallbackData = fromUpcomingTrainingsMenu ? CALLBACK_PREFIX.STAFF.TRAINING.BACK_TO_CLOSEST_TRAINING_LIST : null
    const hasSubstituteTrainer = !!training.trainer

    await ctx.deleteMessage(promptMessageId).catch(() => {})
    await ctx.replyWithHTML(
      MessageHelper.constructTrainingSelectMessage(training, group, this.dateTimeProvider),
      AdminKeyboards.trainingManageMenu(training, backButtonCallbackData, staffUserId, hasSubstituteTrainer),
    )
    return ctx.scene.leave()
  }
}
