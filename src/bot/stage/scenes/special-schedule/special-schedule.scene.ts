import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { CALLBACK_PREFIX, GetGroupByIdResponse, GetTrainingByIdResponse, SCENES, TReplyMarkupKeyboard } from '@app/bot/libs'
import { SceneHelper, BotHelper, UserHelper, KeyboardHelper, TextHelper, CurrentSessionHelper } from '@app/bot/helpers'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { TypedConfigService } from '@app/infrastructure/config'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { AdminKeyboards, CommonSceneKeyboards, CurrentSessionKeyboards, ScheduleKeyboards } from '@app/bot/keyboard/storage'
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
  fromCurrentSession?: boolean // "⏱ Поточне заняття": the visitor is on site, so the signup is created confirmed (from the lead time on)
}

@Injectable()
export class SpecialScheduleScene extends Scenes.WizardScene<BotContext> {
  private readonly specialScheduleScene = new SceneHelper<ISpetialScheduleSceneState>()

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
      await ctx.replyWithHTML(MESSAGES_SCENE.SPECIAL_SCHEDULE.EXIT, this.getExitKeyboard(ctx))
      return this.handleSceneExitAndCleanup(ctx)
    })

    this.enter(async (ctx, next) => {
      const { trainingId } = this.specialScheduleScene.getState(ctx)

      const training = await this.trainingService.getTrainingById(+trainingId)

      if (!training) {
        await ctx.replyWithHTML(MESSAGES_SCENE.SPECIAL_SCHEDULE.NO_TRAINING_FOUND, this.getExitKeyboard(ctx))
        return this.handleSceneExitAndCleanup(ctx)
      }

      const group = await this.groupService.getGroupById(training.groupId)

      if (!group) {
        await ctx.replyWithHTML(MESSAGES_SCENE.SPECIAL_SCHEDULE.NO_GROUP_FOUND, this.getExitKeyboard(ctx))
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
      const { trainingId, group, fromCurrentSession } = this.specialScheduleScene.getState(ctx)
      // On site = present, but not before attendance can be confirmed at all (CONFIRM_LEAD_MINUTES before the start)
      const training = fromCurrentSession ? await this.trainingService.getTrainingById(+trainingId) : null
      const confirm = !!training && CurrentSessionHelper.canConfirmYet(training.date)

      await this.trainingSignupService.createSpecialScheduleSignup({
        trainingId,
        fallbackUsername: textPayload,
        groupId: group.id,
        ...(confirm && { confirmedById: UserHelper.getUser(ctx).id }),
      })

      const confirmedNote = confirm ? ', присутність підтверджено 🟢' : ''
      await ctx.replyWithHTML(`✅ Запис на ім'я ${TextHelper.escapeHtml(textPayload)} успішно створено${confirmedNote}`, this.getExitKeyboard(ctx))
      return this.handleSceneExitAndCleanup(ctx)
    } catch (error) {
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
      this.getExitKeyboard(ctx),
    )
    return ctx.scene.leave()
  }

  private handleSceneExitAndCleanup = async (ctx: BotContext) => {
    const { fromUpcomingTrainingsMenu, staffUserId, trainingId, group, promptMessageId, fromCurrentSession } =
      this.specialScheduleScene.getState(ctx)

    if (fromCurrentSession) {
      await ctx.deleteMessage(promptMessageId).catch(() => {})
      await ctx.replyWithHTML('Повернутися до заняття 👇', CurrentSessionKeyboards.backToTraining(+trainingId))
      return ctx.scene.leave()
    }

    const training = await this.trainingService.getTrainingById(+trainingId)

    const backButtonCallbackData = fromUpcomingTrainingsMenu ? CALLBACK_PREFIX.STAFF.TRAINING.BACK_TO_CLOSEST_TRAINING_LIST : null
    const hasSubstituteTrainer = !!training.trainer

    await ctx.deleteMessage(promptMessageId).catch(() => {})
    await ctx.replyWithHTML(
      MessageHelper.constructTrainingSelectMessage(training, group, this.dateTimeProvider),
      AdminKeyboards.trainingManageMenu(training, backButtonCallbackData, staffUserId, hasSubstituteTrainer, ScheduleKeyboards.backButtonForOrigin(staffUserId)),
    )
    return ctx.scene.leave()
  }

  /** Main menu for this user's role. Computed per update: the scene instance is shared by all users. */
  private getExitKeyboard(ctx: BotContext): TReplyMarkupKeyboard {
    return KeyboardHelper.getRoleBasedMainMenuKeyboard(UserHelper.getUserRole(ctx))
  }
}
