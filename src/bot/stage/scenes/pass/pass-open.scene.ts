import { Injectable } from '@nestjs/common'
import { Scenes } from 'telegraf'
import { BotContext } from '@app/bot/bot.context'
import {
  AuditLogHelper,
  BotHelper,
  KeyboardHelper,
  MessageHelper,
  PassHelper,
  RegexHelper,
  SceneHelper,
  UserHelper,
} from '@app/bot/helpers'
import { CommonSceneKeyboards, PassRelatedKeyboards, OpenPassSceneKeyboards } from '@app/bot/keyboard/storage/scene-keyboards'
import { CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { TypedConfigService } from '@app/infrastructure/config'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { AuditLogActions, AuditLogTrigger, DATE_FORMAT, PassStatusEnum, PassTemplateTypeEnum } from '@app/libs'
import { IPassOpenSceneState, PassOpenSceneHelper } from './pass-open.scene-helper'
import { PassTemplateService } from '@app/domain/pass-template'
import { PassService } from '@app/domain/pass'
import { TrainingSignupService } from '@app/domain/training-signup'

@Injectable()
export class PassOpenScene extends Scenes.WizardScene<BotContext> {
  private readonly scene = new SceneHelper<IPassOpenSceneState>()
  private mainTainerChatId: string

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly configService: TypedConfigService,
    private readonly passTemplateService: PassTemplateService,
    private readonly passService: PassService,
    private readonly trainingSignupService: TrainingSignupService,
  ) {
    super(
      SCENES.PASS_OPEN,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.passInlineMenuActionsHandler(ctx),
    )

    this.mainTainerChatId = this.configService.get('MAINTAINER_CHAT_ID')

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      try {
        const { startMessageId, mainMessageId } = this.scene.getState(ctx, ['startMessageId', 'mainMessageId'])

        const action = async () => {
          await this.renderPassManageMenu(ctx)
        }
        return this.scene.handleAdminSceneExit(ctx, [startMessageId, mainMessageId], action)
      } catch (error) {
        return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
      }
    })

    this.enter(async (ctx, next) => {
      try {
        const todayDateString = this.dateTimeProvider.getTodayDateStringInTz(DATE_FORMAT.DATE_MAIN)
        const message = await ctx.replyWithHTML(MESSAGES_SCENE.PASS_OPEN.WELCOME, CommonSceneKeyboards.exit())
        this.scene.setState(ctx, {
          saleDate: todayDateString,
          startMessageId: message.message_id,
        })
        return await next()
      } catch (error) {
        return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
      }
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    try {
      const message = await this.renderPassTypeSelectMenu(ctx, false)
      if (typeof message !== 'boolean') {
        this.scene.setState(ctx, {
          mainMessageId: message?.message_id,
        })
      }
      return ctx.wizard.next()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private async passInlineMenuActionsHandler(ctx: BotContext) {
    try {
      const { textPayload, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

      if (!isCallbackQueryUpdate) {
        return
      }

      const passTypeSelectActionMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.PASS.TYPE_SELECT, textPayload)
      const templateDetailsActionMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.PASS.TEMPLATE_DETAILS, textPayload)
      const templateSelectActionMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.PASS.TEMPLATE_SELECT, textPayload)
      const backToTemplateListActionMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.PASS.BACK_TO_LIST, textPayload)
      const backToTypeSelectActionMatch = textPayload === CALLBACK_PREFIX.SCENES.PASS.BACK_TO_TYPE_SELECT
      const confirmOpenActionMatch = textPayload === CALLBACK_PREFIX.SCENES.PASS.CONFIRM_OPEN

      switch (true) {
        case !!backToTypeSelectActionMatch: {
          BotHelper.safeAnswerCbQuery(ctx)
          return this.renderPassTypeSelectMenu(ctx, true)
        }
        case !!passTypeSelectActionMatch: {
          const [type] = passTypeSelectActionMatch
          BotHelper.safeAnswerCbQuery(ctx)
          return this.handlePassTypeSelectAction(ctx, type)
        }
        case !!templateDetailsActionMatch: {
          BotHelper.safeAnswerCbQuery(ctx)
          const [templateId] = templateDetailsActionMatch
          return this.handleTemplateDetailsAction(ctx, templateId)
        }
        case !!backToTemplateListActionMatch: {
          BotHelper.safeAnswerCbQuery(ctx)
          return this.renderPassTemplateSelectMenu(ctx)
        }
        case !!templateSelectActionMatch: {
          const [templateId] = templateSelectActionMatch
          return this.handlePassTemplateSelectAction(ctx, templateId)
        }
        case !!confirmOpenActionMatch: {
          BotHelper.safeAnswerCbQuery(ctx)
          return this.handlePassOpenConfirmAction(ctx)
        }
      }
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private renderPassTypeSelectMenu = async (ctx: BotContext, shouldEdit: boolean) => {
    if (shouldEdit) {
      return BotHelper.safeEditMessageText(
        ctx,
        MESSAGES_SCENE.PASS_OPEN.SELECT_PASS_TYPE,
        PassRelatedKeyboards.passTypeInlineKeyboard(),
      )
    } else {
      return ctx.replyWithHTML(MESSAGES_SCENE.PASS_OPEN.SELECT_PASS_TYPE, {
        ...PassRelatedKeyboards.passTypeInlineKeyboard(),
        parse_mode: 'HTML',
      })
    }
  }

  private renderPassTemplateSelectMenu = async (ctx: BotContext) => {
    const { selectedPassType } = this.scene.getState(ctx, ['selectedPassType'])

    const result = await this.passTemplateService.getAll()
    const filteredTemplates = result.filter((template) => template.type === selectedPassType)

    if (!filteredTemplates.length) {
      return await ctx.replyWithHTML(MESSAGES_SCENE.PAYMENT.NO_PASS_TEMPLATES)
    }

    return BotHelper.safeEditMessageText(
      ctx,
      MESSAGES_SCENE.PAYMENT.SELECT_PASS_TEMPLATE,
      PassRelatedKeyboards.passTemplatePreviewInlineKeyboard(filteredTemplates),
    )
  }

  private renderConfirmMenu = async (ctx: BotContext) => {
    const state = this.scene.getState(ctx)

    return BotHelper.safeEditMessageText(
      ctx,
      PassOpenSceneHelper.getInfoMessageForConfirm(state),
      OpenPassSceneKeyboards.confirmPassOpenKeyboard(),
    )
  }

  private handlePassTypeSelectAction = async (ctx: BotContext, type: string) => {
    this.scene.setState(ctx, { selectedPassType: type as PassTemplateTypeEnum })
    return this.renderPassTemplateSelectMenu(ctx)
  }

  private async handleTemplateDetailsAction(ctx: BotContext, templateId: string) {
    const passTemplateData = await this.passTemplateService.getById(templateId)

    return BotHelper.safeEditMessageText(
      ctx,
      MessageHelper.constructPassSelectMessage(passTemplateData),
      PassRelatedKeyboards.passTemplateSelectInlineKeyboard(templateId),
    )
  }

  private handlePassTemplateSelectAction = async (ctx: BotContext, templateId: string) => {
    const passTemplateData = await this.passTemplateService.getById(templateId)
    const { userProfile, saleDate } = this.scene.getState(ctx)

    if (passTemplateData.passTemplateAgeRestriction && userProfile?.dateOfBirth) {
      const { minAge, maxAge } = passTemplateData.passTemplateAgeRestriction
      const age = this.dateTimeProvider.getAgeFromBirthday(userProfile.dateOfBirth)
      // todo: handle exeption passTemplateAgeRestrictionExeptions
      const meetsMinAge = minAge === null || age >= minAge
      const meetsMaxAge = maxAge === null || age <= maxAge

      if (!meetsMinAge || !meetsMaxAge) {
        const ageRangeText =
          minAge !== null && maxAge !== null
            ? `${minAge} - ${maxAge} років`
            : minAge !== null
              ? `від ${minAge} років`
              : `до ${maxAge} років`

        BotHelper.safeAnswerCbQuery(
          ctx,
          `😔 Цей абонемент призначений для іншої вікової групи.\n\n👤 Твій вік: ${age} років\n📋 Потрібний вік: ${ageRangeText}\n\n💡 Спробуй обрати інший абонемент!`,
          { show_alert: true },
        )
        return ctx.deleteMessage()
      }
    }

    BotHelper.safeAnswerCbQuery(ctx)

    this.scene.setState(ctx, { passTemplate: passTemplateData })
    return this.renderConfirmMenu(ctx)
  }

  private handlePassOpenConfirmAction = async (ctx: BotContext) => {
    try {
      const state = this.scene.getState(ctx)
      const { userProfile, saleDate, passTemplate, mainMessageId, startMessageId } = state

      const [newPass, logOperations] = await this.passService.createNewPassForExistingClient(
        userProfile.client.id,
        {
          passTemplateId: passTemplate.id,
          saleDate,
          clientId: userProfile.client.id,
          status: PassStatusEnum.ACTIVE,
        },
        passTemplate.durationDays,
      )

      AuditLogHelper.startAction(ctx, AuditLogActions.PASS_CREATE, AuditLogTrigger.ADMIN_ACTION, logOperations)

      ctx.deleteMessages([startMessageId, mainMessageId]).catch(() => {})
      this.scene.setState(ctx, { newPassId: newPass.id })

      const { role } = UserHelper.getUser(ctx)
      const keyboard = KeyboardHelper.getRoleBasedMainMenuKeyboard(role)

      await Promise.all([
        ctx.replyWithHTML(`✅ Абонемент успішно відкрито!`, keyboard),
        BotHelper.safeSendMessage(ctx.telegram, userProfile.telegramId, PassOpenSceneHelper.getClientInfoMessage(state)),
      ])

      await this.renderPassManageMenu(ctx)
      return ctx.scene.leave()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private renderPassManageMenu = async (ctx: BotContext) => {
    const { originalPass, newPassId = null, userProfile } = this.scene.getState(ctx)
    const pass = await this.passService.getPassById(newPassId ?? originalPass.id)

    if (!pass) {
      await ctx.replyWithHTML('❌ Не вдалося завантажити абонемент для відображення меню управління.')
      return ctx.scene.leave()
    }

    const trainingSignups = await this.trainingSignupService.getTrainingSignupByPassId(pass.id)

    await PassHelper.renderPassManageMenu(ctx, this.dateTimeProvider, {
      pass: pass as typeof originalPass,
      fullName: UserHelper.getDisplayName(userProfile),
      clientUserId: userProfile.id,
      shouldEdit: false,
      trainingSignups,
    })
  }
}
