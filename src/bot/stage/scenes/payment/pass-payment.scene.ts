import { BotHelper, PassHelper, RegexHelper, SceneHelper, UserHelper } from '@app/bot/helpers'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { BotContext } from '@app/bot/bot.context'
import { AdminKeyboards, ClientKeyboards, CommonSceneKeyboards } from '@app/bot/keyboard/storage'
import { PassRelatedKeyboards } from '@app/bot/keyboard/storage/scene-keyboards'
import { AuthUserProfile, CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { PassTemplateService } from '@app/domain/pass-template'
import { TypedConfigService } from '@app/infrastructure/config'
import { PassTemplateSelectModel } from '@app/infrastructure/database'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import {
  AuditLogActions,
  AuditLogTrigger,
  DATE_FORMAT,
  PassActivationFileTypeEnum,
  PassActivationRequestTypeEnum,
  PassStatusEnum,
  PassTemplateTypeEnum,
} from '@app/libs'
import { Injectable } from '@nestjs/common'
import { Scenes } from 'telegraf'
import { UserProfileService } from '@app/domain/user-profile'
import { PassService } from '@app/domain/pass'
import { AuditLogHelper } from '@app/bot/helpers/audit-log.helper'

interface IPassPaymentSceneState {
  userProfile: AuthUserProfile
  fileIds: string[]
  fileType: PassActivationFileTypeEnum
  requestType: PassActivationRequestTypeEnum
  fileUpdateMessageIds: (number | null)[]
  passTemplate: PassTemplateSelectModel
  saleDate: string
  startMessageId: number | null
  menuMessageId: number | null
  selectedPassType: PassTemplateTypeEnum | null
}

@Injectable()
export class PassPaymentScene extends Scenes.WizardScene<BotContext> {
  private readonly passPaymentScene = new SceneHelper<IPassPaymentSceneState>()

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly configService: TypedConfigService,
    private readonly passTemplateService: PassTemplateService,
    private readonly userProfileService: UserProfileService,
    private readonly passService: PassService,
  ) {
    super(
      SCENES.PASS_PAYMENT,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.passInlineMenuActionsHandler(ctx),
      (ctx) => this.filesUploadHandler(ctx),
    )

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      const { requestType } = this.passPaymentScene.getState(ctx, ['requestType'])

      const message =
        requestType === PassActivationRequestTypeEnum.PURCHASE
          ? MESSAGES_SCENE.PAYMENT.PASS_PURCHASE_EXIT
          : MESSAGES_SCENE.PAYMENT.PASS_RENEW_EXIT

      await ctx.replyWithHTML(message, ClientKeyboards.mainMenu())
      return ctx.scene.leave()
    })

    this.enter(async (ctx, next) => {
      const { requestType } = this.passPaymentScene.getState(ctx, ['requestType'])

      const todayDateString = this.dateTimeProvider.getTodayDateStringInTz(DATE_FORMAT.DATE_MAIN)

      const messageText =
        requestType === PassActivationRequestTypeEnum.PURCHASE
          ? MESSAGES_SCENE.PAYMENT.PASS_PURCHASE_WELCOME
          : MESSAGES_SCENE.PAYMENT.PASS_RENEW_WELCOME

      const message = await ctx.replyWithHTML(messageText, CommonSceneKeyboards.exit())
      this.passPaymentScene.setState(ctx, {
        saleDate: todayDateString,
        startMessageId: message.message_id,
        fileIds: [],
        fileUpdateMessageIds: [],
      })
      return await next()
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    try {
      await this.renderPassTypeSelectMenu(ctx, false)
      return ctx.wizard.next()
    } catch (error) {
      await this.handleError(ctx, error)
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
      }
    } catch (error) {
      await this.handleError(ctx, error)
    }
  }

  private async filesUploadHandler(ctx: BotContext) {
    try {
      const { textPayload, fileId, isFileUpdate, isCallbackQueryUpdate, isTextUpdate, fileType } = BotHelper.getUpdatePayload(ctx)
      if (isTextUpdate) {
        return
      }

      if (isCallbackQueryUpdate) {
        return this.fileInlineMenuActionsHandler(ctx, textPayload)
      }

      if (isFileUpdate && fileId && fileType) {
        const { fileIds, fileUpdateMessageIds, menuMessageId } = this.passPaymentScene.getState(ctx, [
          'fileIds',
          'fileUpdateMessageIds',
          'menuMessageId',
        ])

        this.passPaymentScene.setState(ctx, {
          fileIds: [...fileIds, fileId],
        })

        if (fileIds.length) {
          this.passPaymentScene.setState(ctx, { fileIds: [...fileIds] })
          return await ctx.deleteMessage().catch(() => null)
        }

        this.passPaymentScene.setState(ctx, {
          fileType,
          fileUpdateMessageIds: [...fileUpdateMessageIds, ctx.message?.message_id ?? null],
        })

        if (menuMessageId) {
          await ctx.deleteMessage(menuMessageId).catch(() => null)
        }

        const newMenuMessageId = await this.renderFileUploadMenu(ctx, false)
        this.passPaymentScene.setState(ctx, { menuMessageId: newMenuMessageId ?? null })
      }
    } catch (error) {
      await this.handleError(ctx, error)
    }
  }

  private fileInlineMenuActionsHandler = async (ctx: BotContext, textPayload: string) => {
    try {
      BotHelper.safeAnswerCbQuery(ctx)
      switch (textPayload) {
        case CALLBACK_PREFIX.SCENES.FILE.BACK: {
          await this.renderPassTemplateSelectMenu(ctx)
          return ctx.wizard.selectStep(1)
        }
        case CALLBACK_PREFIX.SCENES.FILE.CONFIRM: {
          return this.handleFileConfirmAction(ctx)
        }
        case CALLBACK_PREFIX.SCENES.FILE.RESET: {
          return this.handleFileResetAction(ctx)
        }
      }
    } catch (error) {
      await this.handleError(ctx, error)
    }
  }

  private handlePassTypeSelectAction = async (ctx: BotContext, type: string) => {
    this.passPaymentScene.setState(ctx, { selectedPassType: type as PassTemplateTypeEnum })
    return this.renderPassTemplateSelectMenu(ctx)
  }

  private async handleTemplateDetailsAction(ctx: BotContext, templateId: string) {
    const passTemplateData = await this.passTemplateService.getById(templateId)
    return ctx.editMessageText(MessageHelper.constructPassSelectMessage(passTemplateData), {
      ...PassRelatedKeyboards.passTemplateSelectInlineKeyboard(templateId),
      parse_mode: 'HTML',
    })
  }

  private handlePassTemplateSelectAction = async (ctx: BotContext, templateId: string) => {
    const passTemplateData = await this.passTemplateService.getById(templateId)
    const { userProfile } = this.passPaymentScene.getState(ctx)

    if (passTemplateData.passTemplateAgeRestriction && userProfile?.dateOfBirth) {
      const { minAge, maxAge } = passTemplateData.passTemplateAgeRestriction
      const age = this.dateTimeProvider.getAgeFromBirthday(userProfile.dateOfBirth)

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

    this.passPaymentScene.setState(ctx, { passTemplate: passTemplateData })

    const message_id = await this.renderFileUploadMenu(ctx)

    this.passPaymentScene.setState(ctx, { menuMessageId: message_id ?? null })
    return ctx.wizard.next()
  }

  private handleFileConfirmAction = async (ctx: BotContext) => {
    const {
      fileUpdateMessageIds,
      menuMessageId,
      startMessageId,
      fileIds,
      userProfile,
      saleDate,
      passTemplate,
      fileType,
      requestType,
    } = this.passPaymentScene.getState(ctx)

    const messagesToDelete = [...fileUpdateMessageIds, menuMessageId, startMessageId].filter((id): id is number => id !== null)
    const fileId = fileIds[0]

    const [_, activationRequest, logOperations] = await this.passService.createPassWithActivationRequest({
      saleDate,
      clientId: userProfile.client!.id,
      passTemplateId: passTemplate.id,
      status: PassStatusEnum.REQUESTED,
      availableSlots: passTemplate.length,
      fileId,
      fileType,
      type: requestType,
    })
    AuditLogHelper.startAction(ctx, AuditLogActions.PASS_ACTIVATE_REQUEST, AuditLogTrigger.CLIENT_ACTION, logOperations)

    await ctx.deleteMessages(messagesToDelete)

    const studioAdmins = await this.userProfileService.findStudioAdmins()
    const method = fileType === PassActivationFileTypeEnum.PHOTO ? 'sendPhoto' : 'sendDocument'

    for (const admin of studioAdmins) {
      await ctx.telegram[method](admin.telegramId, fileId, {
        caption: MessageHelper.getClientPassPaymentRequestMessage(userProfile, passTemplate, requestType),
        ...AdminKeyboards.verifyPassActions(activationRequest.id),
        parse_mode: 'HTML',
      })
    }
    await ctx.replyWithHTML(MESSAGES_SCENE.PAYMENT.PASS_REQUEST_SUCCESS, ClientKeyboards.mainMenu())
    return ctx.scene.leave()
  }

  private handleFileResetAction = async (ctx: BotContext) => {
    const { fileUpdateMessageIds } = this.passPaymentScene.getState(ctx, ['fileUpdateMessageIds'])
    const sanitizedIds = fileUpdateMessageIds.filter((id): id is number => id !== null)
    await ctx.deleteMessages(sanitizedIds)
    this.passPaymentScene.setState(ctx, { fileIds: [], fileUpdateMessageIds: [] })
    const message_id = await this.renderFileUploadMenu(ctx)
    this.passPaymentScene.setState(ctx, { menuMessageId: message_id ?? null })
    return
  }

  private renderPassTypeSelectMenu = async (ctx: BotContext, shouldEdit: boolean) => {
    if (shouldEdit) {
      return ctx.editMessageText(MESSAGES_SCENE.VERIFY_CLIENT.SELECT_PASS_TYPE, {
        ...PassRelatedKeyboards.passTypeInlineKeyboard(),
        parse_mode: 'HTML',
      })
    } else {
      return ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.SELECT_PASS_TYPE, {
        ...PassRelatedKeyboards.passTypeInlineKeyboard(),
        parse_mode: 'HTML',
      })
    }
  }

  private renderPassTemplateSelectMenu = async (ctx: BotContext) => {
    const { selectedPassType } = this.passPaymentScene.getState(ctx, ['selectedPassType'])

    const result = await this.passTemplateService.getAll()
    const filteredTemplates = result.filter((template) => template.type === selectedPassType)

    if (!filteredTemplates.length) {
      return await ctx.replyWithHTML(MESSAGES_SCENE.PAYMENT.NO_PASS_TEMPLATES)
    }

    return ctx.editMessageText(MESSAGES_SCENE.PAYMENT.SELECT_PASS_TEMPLATE, {
      ...PassRelatedKeyboards.passTemplatePreviewInlineKeyboard(filteredTemplates),
      parse_mode: 'HTML',
    })
  }

  private renderFileUploadMenu = async (ctx: BotContext, shouldEdit: boolean = true): Promise<number | undefined> => {
    const { passTemplate, fileIds } = this.passPaymentScene.getState(ctx, ['passTemplate', 'fileIds'])
    let message = `✅ Обраний абонемент: <b>${passTemplate.name}</b>\n💰 Вартість: <b>${PassHelper.toDisplayPrice(passTemplate.price)}</b>\n\n`

    if (fileIds.length) {
      message += `📸 Файл успішно отримано\n\n`
      message += `${BUTTON_PATTERNS.CONFIRM} - якщо все вірно\n\n${BUTTON_PATTERNS.DELETE}, щоб завантажити інший.`
    } else {
      message += '📸 Надішли скріншот оплати в цей чат (фото або файлом)'
    }

    if (shouldEdit) {
      const result = await ctx.editMessageText(message, {
        ...PassRelatedKeyboards.passPurchaseFileUploadInlineKeyboard(Boolean(fileIds.length)),
        parse_mode: 'HTML',
      })
      if (result === true) {
        BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка оновлення повідомлення. Спробуйте ще раз.', { show_alert: true })
      } else {
        return result?.message_id
      }
    } else {
      const result = await ctx.replyWithHTML(
        message,
        PassRelatedKeyboards.passPurchaseFileUploadInlineKeyboard(Boolean(fileIds.length)),
      )
      return result?.message_id
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
      ClientKeyboards.mainMenu(),
    )
    return ctx.scene.leave()
  }
}
