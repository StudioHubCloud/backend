import { Injectable } from '@nestjs/common'
import { Scenes } from 'telegraf'
import { BotContext } from '@app/bot/bot.context'
import { BotHelper, KeyboardHelper, PersonalTrainingHelper, SceneHelper, TextHelper, UserHelper } from '@app/bot/helpers'
import { SCENES } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { CommonSceneKeyboards, ScheduleKeyboards } from '@app/bot/keyboard/storage'
import { TypedConfigService } from '@app/infrastructure/config'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { PersonalTrainingSignupService } from '@app/domain/personal-training-signup'

const NOTE_MAX_LENGTH = 500

export interface IPersonalTrainingNoteEditSceneState {
  signupId: string
}

/** Admin edit of a one-off session's note (who came, wishes, anything), opened from the studio schedule. */
@Injectable()
export class PersonalTrainingNoteEditScene extends Scenes.WizardScene<BotContext> {
  private readonly scene = new SceneHelper<IPersonalTrainingNoteEditSceneState>()
  private mainTainerChatId: string

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly configService: TypedConfigService,
    private readonly personalTrainingSignupService: PersonalTrainingSignupService,
  ) {
    super(
      SCENES.PERSONAL_TRAINING_NOTE_EDIT,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.noteHandler(ctx),
    )

    this.mainTainerChatId = this.configService.get('MAINTAINER_CHAT_ID')

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      const { role } = UserHelper.getUser(ctx)
      await ctx.replyWithHTML(MESSAGES_SCENE.PERSONAL_TRAINING_NOTE_EDIT.EXIT, KeyboardHelper.getRoleBasedMainMenuKeyboard(role))
      return ctx.scene.leave()
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    try {
      const { signupId } = this.scene.getState(ctx)
      const signup = signupId ? await this.personalTrainingSignupService.findById(signupId) : null

      if (!signup?.studioPriceId) {
        await ctx.replyWithHTML(MESSAGES_SCENE.PERSONAL_TRAINING_NOTE_EDIT.NOT_FOUND)
        return ctx.scene.leave()
      }

      const current = signup.participantsNote ? `${MESSAGES_SCENE.PERSONAL_TRAINING_NOTE_EDIT.CURRENT} <i>${TextHelper.escapeHtml(signup.participantsNote)}</i>\n\n` : ''
      await ctx.replyWithHTML(`${current}${MESSAGES_SCENE.PERSONAL_TRAINING_NOTE_EDIT.ENTER}`, CommonSceneKeyboards.exit())

      return ctx.wizard.next()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private noteHandler = async (ctx: BotContext) => {
    try {
      const { textPayload, isTextUpdate, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

      if (!isTextUpdate) {
        return isCallbackQueryUpdate ? BotHelper.safeAnswerCbQuery(ctx) : undefined
      }

      const note = textPayload?.trim()

      if (!note || note.length > NOTE_MAX_LENGTH) {
        await ctx.replyWithHTML(MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.ENTER_PARTICIPANTS_ERROR)
        return
      }

      const { signupId } = this.scene.getState(ctx)
      const updated = await this.personalTrainingSignupService.updateOneOffNote(signupId, note)

      const { role } = UserHelper.getUser(ctx)

      if (!updated) {
        await ctx.replyWithHTML(MESSAGES_SCENE.PERSONAL_TRAINING_NOTE_EDIT.NOT_FOUND, KeyboardHelper.getRoleBasedMainMenuKeyboard(role))
        return ctx.scene.leave()
      }

      await ctx.replyWithHTML(MESSAGES_SCENE.PERSONAL_TRAINING_NOTE_EDIT.SUCCESS, KeyboardHelper.getRoleBasedMainMenuKeyboard(role))

      // Back to the session menu, now with the new note
      const session = await this.personalTrainingSignupService.findById(signupId)
      if (session) {
        await ctx.replyWithHTML(
          PersonalTrainingHelper.getAdminSessionMessage(session, this.dateTimeProvider),
          ScheduleKeyboards.session(session, this.dateTimeProvider, { canManage: true, canConfirm: true, isMaintainer: UserHelper.isMaintainerRole(ctx) }), // admin-only scene
        )
      }

      return ctx.scene.leave()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }
}
