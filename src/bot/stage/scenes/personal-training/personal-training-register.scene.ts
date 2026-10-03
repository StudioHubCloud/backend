import { Injectable } from '@nestjs/common'
import { Scenes } from 'telegraf'
import { parse } from 'date-fns'
import { BotContext } from '@app/bot/bot.context'
import {
  BotHelper,
  KeyboardHelper,
  PersonalTrainingHelper,
  RegexHelper,
  SceneHelper,
  TextHelper,
  UserHelper,
} from '@app/bot/helpers'
import { CALLBACK_PREFIX, SCENES, UserProfileWithClient } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { TypedConfigService } from '@app/infrastructure/config'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { CommonSceneKeyboards, PersonalTrainingRegisterSceneKeyboards } from '@app/bot/keyboard/storage/scene-keyboards'
import { AuditLogActions, AuditLogTrigger, DATE_FORMAT, PassTemplateTypeEnum } from '@app/libs'
import { StaffMemberSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'
import { PassService } from '@app/domain/pass'
import { UserProfileService } from '@app/domain/user-profile'
import { PersonalTrainingSignupService } from '@app/domain/personal-training-signup'
import { AuditLogHelper } from '@app/bot/helpers/audit-log.helper'

export interface IPersonalTrainingRegisterSceneState {
  clientUserProfile: UserProfileWithClient
  staffMember: StaffMemberSelectModel & { userProfile: UserProfileSelectModel }
  scheduledDate: string
  scheduledAt: string
}

/**
 * Admin-driven registration of an individual training.
 *
 * The client and trainer agree offline; the trainer reports the date and time to the admin, who
 * records it here. The date may be in the past or the future — the admin is transcribing an
 * agreement, not booking a slot, so no future-date guard applies.
 */
@Injectable()
export class PersonalTrainingRegisterScene extends Scenes.WizardScene<BotContext> {
  private readonly scene = new SceneHelper<IPersonalTrainingRegisterSceneState>()
  private mainTainerChatId: string

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly configService: TypedConfigService,
    private readonly passService: PassService,
    private readonly userProfileService: UserProfileService,
    private readonly personalTrainingSignupService: PersonalTrainingSignupService,
  ) {
    super(
      SCENES.PERSONAL_TRAINING_REGISTER,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.trainerSelectHandler(ctx),
      (ctx) => this.dateHandler(ctx),
      (ctx) => this.timeHandler(ctx),
      (ctx) => this.confirmHandler(ctx),
    )

    this.mainTainerChatId = this.configService.get('MAINTAINER_CHAT_ID')

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      const { role } = UserHelper.getUser(ctx)
      await ctx.replyWithHTML(
        MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.EXIT,
        KeyboardHelper.getRoleBasedMainMenuKeyboard(role),
      )
      return ctx.scene.leave()
    })

    this.enter(async (ctx, next) => {
      try {
        const { clientUserProfile } = this.scene.getState(ctx, ['clientUserProfile'])
        const guardMessage = await this.resolveGuardFailure(clientUserProfile)

        if (guardMessage) {
          await ctx.replyWithHTML(guardMessage)
          return ctx.scene.leave()
        }

        return await next()
      } catch (error) {
        return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
      }
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    try {
      const trainers = await this.userProfileService.getAllActiveStaffMembersUserProfiles()

      if (!trainers.length) {
        await ctx.replyWithHTML(MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.NO_TRAINERS)
        return ctx.scene.leave()
      }

      await ctx.replyWithHTML(MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.SELECT_TRAINER, {
        ...PersonalTrainingRegisterSceneKeyboards.trainerSelectInlineKeyboard(trainers),
      })

      return ctx.wizard.next()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  /** Returns a message when the client cannot receive an individual training, or null when they can. */
  private async resolveGuardFailure(clientUserProfile: UserProfileWithClient): Promise<string | null> {
    const activePass = await this.passService.findActivePassByClientId(clientUserProfile?.client?.id)

    if (!activePass) {
      return MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.NO_ACTIVE_PASS
    }
    if (activePass.passTemplate.type !== PassTemplateTypeEnum.INDIVIDUAL) {
      return MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.WRONG_PASS_TYPE
    }
    if (activePass.availableSlots <= 0) {
      return MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.NO_SLOTS
    }
    return null
  }

  private trainerSelectHandler = async (ctx: BotContext) => {
    try {
      const { textPayload, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

      if (!isCallbackQueryUpdate) {
        return
      }

      const trainerSelectMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.PERSONAL_TRAINING.TRAINER_SELECT, textPayload)

      if (!trainerSelectMatch) {
        return
      }

      const [staffMemberId] = trainerSelectMatch
      BotHelper.safeAnswerCbQuery(ctx)

      const trainers = await this.userProfileService.getAllActiveStaffMembersUserProfiles()
      const selectedTrainer = trainers.find((trainer) => trainer.staffMember?.id === staffMemberId)

      if (!selectedTrainer?.staffMember) {
        await ctx.replyWithHTML(MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.NO_TRAINERS)
        return ctx.scene.leave()
      }

      this.scene.setState(ctx, {
        staffMember: { ...selectedTrainer.staffMember, userProfile: selectedTrainer },
      })

      const todayDateString = this.dateTimeProvider.getTodayDateStringInTz(DATE_FORMAT.DATE_INPUT)
      await ctx.replyWithHTML(
        MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.ENTER_DATE,
        PersonalTrainingRegisterSceneKeyboards.dateWithSuggestion(todayDateString),
      )

      return ctx.wizard.next()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private dateHandler = async (ctx: BotContext) => {
    try {
      const { textPayload, isTextUpdate } = BotHelper.getUpdatePayload(ctx)

      if (!isTextUpdate) {
        return
      }

      const validatedDate = TextHelper.validateDateInput(textPayload)

      if (!validatedDate) {
        const todayDateString = this.dateTimeProvider.getTodayDateStringInTz(DATE_FORMAT.DATE_INPUT)
        await ctx.replyWithHTML(
          MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.ENTER_DATE_ERROR,
          PersonalTrainingRegisterSceneKeyboards.dateWithSuggestion(todayDateString),
        )
        return
      }

      this.scene.setState(ctx, { scheduledDate: validatedDate })
      await ctx.replyWithHTML(MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.ENTER_TIME, CommonSceneKeyboards.exit())

      return ctx.wizard.next()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private timeHandler = async (ctx: BotContext) => {
    try {
      const { textPayload, isTextUpdate } = BotHelper.getUpdatePayload(ctx)

      if (!isTextUpdate) {
        return
      }

      const validatedTime = TextHelper.validateTimeInput(textPayload)

      if (!validatedTime) {
        await ctx.replyWithHTML(MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.ENTER_TIME_ERROR, CommonSceneKeyboards.exit())
        return
      }

      const { scheduledDate, clientUserProfile, staffMember } = this.scene.getState(ctx)

      // Studio-local wall clock -> UTC instant. getUtcString() would treat it as already-UTC and shift it.
      const parsedDate = parse(scheduledDate, DATE_FORMAT.DATE_INPUT, new Date())
      const scheduledAt = this.dateTimeProvider.getUtcStringTz(this.dateTimeProvider.addTimeToDate(parsedDate, validatedTime))

      this.scene.setState(ctx, { scheduledAt })

      const confirmMessage = PersonalTrainingHelper.getRegisterConfirmMessage(
        UserHelper.getDisplayName(clientUserProfile),
        UserHelper.getDisplayName(staffMember.userProfile),
        scheduledAt,
        this.dateTimeProvider,
      )

      await ctx.replyWithHTML(confirmMessage, CommonSceneKeyboards.backExitConfirm())
      return ctx.wizard.next()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private confirmHandler = async (ctx: BotContext) => {
    try {
      const { textPayload, isTextUpdate } = BotHelper.getUpdatePayload(ctx)

      if (!isTextUpdate) {
        return
      }

      if (textPayload === BUTTON_PATTERNS.BACK) {
        await ctx.replyWithHTML(MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.ENTER_TIME, CommonSceneKeyboards.exit())
        return ctx.wizard.back()
      }

      if (textPayload !== BUTTON_PATTERNS.CONFIRM) {
        return
      }

      const { clientUserProfile, staffMember, scheduledAt } = this.scene.getState(ctx)

      const [created, logOperations] = await this.personalTrainingSignupService.registerTraining({
        clientId: clientUserProfile.client.id,
        staffMemberId: staffMember.id,
        scheduledAt,
      })

      AuditLogHelper.startAction(ctx, AuditLogActions.PERSONAL_TRAINING_REGISTER, AuditLogTrigger.ADMIN_ACTION, logOperations)

      const updatedPass = created.passId ? await this.passService.getPassById(created.passId) : null
      const remainingSlots = updatedPass?.availableSlots ?? 0

      await BotHelper.safeSendMessage(
        ctx.telegram,
        clientUserProfile.telegramId,
        PersonalTrainingHelper.getClientRegisteredMessage(
          UserHelper.getDisplayName(staffMember.userProfile),
          scheduledAt,
          remainingSlots,
          this.dateTimeProvider,
        ),
      )

      const { role } = UserHelper.getUser(ctx)
      await ctx.replyWithHTML(
        MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.REGISTER_SUCCESS,
        KeyboardHelper.getRoleBasedMainMenuKeyboard(role),
      )

      return ctx.scene.leave()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }
}
