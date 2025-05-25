import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { addDays } from 'date-fns'
import { BotContext } from '@app/bot/bot.context'
import { CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { SceneHelper, BotHelper, RegexHelper, TextHelper } from '@app/bot/helpers'
import { MESSAGES_COMMON, MESSAGES_SCENE } from '@app/bot/static/messages'
import { PATTERNS_COMMON, PATTERNS_SCENE } from '@app/bot/static/patterns'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { AdminKeyboards, ClientKeyboards } from '@app/bot/modules/keyboard/storage'
import { PassTemplateService } from '@app/domain/pass-template/pass-template.service'
import { CommonSceneKeyboards, VerifyClientSceneKeyboards } from '@app/bot/modules/keyboard/storage/scene-keyboards'
import { DATE_FORMAT, PassTemplateTypeEnum } from '@app/libs'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { IVerifyClientSceneState, VerifyClientSceneHelper } from './verify-client.scene-helper'
import { UserProfileService } from '@app/domain/user-profile'

@Injectable()
export class VerifyClientScene extends Scenes.WizardScene<BotContext> {
  private readonly verifyClientScene = new SceneHelper<IVerifyClientSceneState>()
  private currentDate: string
  private currentAnd30DaysDate: string

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeService: DateTimeProvider,
    private readonly passTemplateService: PassTemplateService,
    private readonly userProfileService: UserProfileService,
  ) {
    super(
      SCENES.VERIFY_CLIENT,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.passTypeAndTemplateHandler(ctx),
      (ctx) => this.passStartDateHandler(ctx),
      (ctx) => this.passExpirationDateHandler(ctx),
      (ctx) => this.completeHandler(ctx),
    )

    this.hears(PATTERNS_COMMON.EXIT, async (ctx) => {
      await ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.EXIT, AdminKeyboards.mainMenu())
      return ctx.scene.leave()
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    this.currentDate = this.dateTimeService.formatDate({ dateFormat: DATE_FORMAT.DATE_INPUT })
    this.currentAnd30DaysDate = this.dateTimeService.formatDate({
      dateFormat: DATE_FORMAT.DATE_INPUT,
      date: addDays(new Date(), 30),
    })

    await ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.SELECT_PASS_TYPE, VerifyClientSceneKeyboards.passType())
    return ctx.wizard.next()
  }

  private passTypeAndTemplateHandler = async (ctx: BotContext) => {
    const data = BotHelper.getUpdatePayload(ctx)
    const textUpdate = BotHelper.isTextUpdate(ctx)

    if (textUpdate) {
      let passType: PassTemplateTypeEnum
      switch (data) {
        case PATTERNS_SCENE.VERIFY_CLIENT.GROUP_PASS_TYPE:
          passType = PassTemplateTypeEnum.GROUP
          break
        case PATTERNS_SCENE.VERIFY_CLIENT.INDIVIDUAL_PASS_TYPE:
          passType = PassTemplateTypeEnum.INDIVIDUAL
          break
        default:
          break
      }

      const result = await this.passTemplateService.getAll()
      const filteredTemplates = result.filter((template) => (passType ? template.type === passType : true))

      if (!filteredTemplates.length) {
        await ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.NO_PASS_TEMPLATES)
        return ctx.scene.leave()
      }

      await ctx.replyWithHTML(
        MESSAGES_SCENE.VERIFY_CLIENT.SELECT_PASS,
        VerifyClientSceneKeyboards.passTemplatePreviewInlineKeyboard(filteredTemplates),
      )
    } else {
      const previewTemplateActionMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.VERIFY_SCENE_PASS_TEMPLATE_PREVIEW, data)
      const selectTemplateActionMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.VERIFY_SCENE_PASS_TEMPLATE_SELECT, data)
      if (previewTemplateActionMatch) {
        ctx.answerCbQuery()
        const [id] = previewTemplateActionMatch
        const passTemplateData = await this.passTemplateService.getById(id)
        return ctx.replyWithHTML(
          MessageHelper.constructPassSelectMessage(passTemplateData),
          VerifyClientSceneKeyboards.passTemplateSelectInlineKeyboard(id),
        )
      }
      if (selectTemplateActionMatch) {
        const [id] = selectTemplateActionMatch
        const passTemplateData = await this.passTemplateService.getById(id)
        const { userProfile } = this.verifyClientScene.getState(ctx)

        if (passTemplateData.passTemplateAgeRestriction) {
          const { minAge, maxAge } = passTemplateData.passTemplateAgeRestriction
          const age = this.dateTimeService.getAgeFromBirthday(userProfile!.dateOfBirth!)

          if (age < (minAge ?? Infinity) || age > (maxAge ?? -Infinity)) {
            ctx.answerCbQuery(
              `Клієнт не відповідає віковим обмеженням для цього абонементу.\n\nВік: ${age} років\n` +
                `Вікові обмеження: ${minAge} - ${maxAge} років`,
              { show_alert: true },
            )
            return ctx.deleteMessage()
          }
        }
        ctx.answerCbQuery()
        this.verifyClientScene.setState(ctx, { passTemplate: passTemplateData })
        await ctx.replyWithHTML(
          MESSAGES_SCENE.VERIFY_CLIENT.PROVIDE_PASS_START_DATE,
          CommonSceneKeyboards.dateWithSuggestion(this.currentDate),
        )
        return ctx.wizard.next()
      }
    }
  }

  private passStartDateHandler = async (ctx: BotContext) => {
    const isCallbackQueryUpdate = BotHelper.isCallbackQueryUpdate(ctx)

    if (isCallbackQueryUpdate) {
      return ctx.answerCbQuery()
    }

    const data = BotHelper.getUpdatePayload(ctx)

    switch (data) {
      case PATTERNS_COMMON.BACK:
        await ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.SELECT_PASS_TYPE, VerifyClientSceneKeyboards.passType())
        return ctx.wizard.back()
      default:
        break
    }

    const startDate = TextHelper.validateDOB(data)

    if (!startDate) {
      return ctx.replyWithHTML(MESSAGES_COMMON.DATE_ERROR)
    }

    this.verifyClientScene.setState(ctx, { startDate })

    await ctx.replyWithHTML(
      MESSAGES_SCENE.VERIFY_CLIENT.PROVIDE_PASS_EXPIRATION_DATE,
      CommonSceneKeyboards.dateWithSuggestion(this.currentAnd30DaysDate),
    )
    return ctx.wizard.next()
  }

  private passExpirationDateHandler = async (ctx: BotContext) => {
    const isCallbackQueryUpdate = BotHelper.isCallbackQueryUpdate(ctx)

    if (isCallbackQueryUpdate) {
      return ctx.answerCbQuery()
    }

    const data = BotHelper.getUpdatePayload(ctx)

    switch (data) {
      case PATTERNS_COMMON.BACK:
        await ctx.replyWithHTML(
          MESSAGES_SCENE.VERIFY_CLIENT.PROVIDE_PASS_START_DATE,
          CommonSceneKeyboards.dateWithSuggestion(this.currentDate),
        )
        return ctx.wizard.back()
      default:
        break
    }

    const endDate = TextHelper.validateDOB(data)

    if (!endDate) {
      return ctx.replyWithHTML(MESSAGES_COMMON.DATE_ERROR)
    }

    this.verifyClientScene.setState(ctx, { endDate })

    const state = this.verifyClientScene.getState(ctx) as IVerifyClientSceneState

    const text = VerifyClientSceneHelper.getInfoMessageForConfirm(state)

    await ctx.replyWithHTML(text, CommonSceneKeyboards.confirm())
    return ctx.wizard.next()
  }

  private completeHandler = async (ctx: BotContext) => {
    const isCallbackQueryUpdate = BotHelper.isCallbackQueryUpdate(ctx)

    if (isCallbackQueryUpdate) {
      return ctx.answerCbQuery()
    }

    const data = BotHelper.getUpdatePayload(ctx)

    switch (data) {
      case PATTERNS_COMMON.BACK:
        await ctx.replyWithHTML(
          MESSAGES_SCENE.VERIFY_CLIENT.PROVIDE_PASS_EXPIRATION_DATE,
          CommonSceneKeyboards.dateWithSuggestion(this.currentAnd30DaysDate),
        )
        return ctx.wizard.back()
      default:
        break
    }

    if (data !== PATTERNS_COMMON.CONFIRM) {
      return
    }

    const { endDate, passTemplate, startDate, userProfile } = this.verifyClientScene.getState(ctx) as IVerifyClientSceneState

    await this.userProfileService.verifyClient({
      userProfile,
      passTemplate,
      endDate: this.dateTimeService.parseAndFormatDate({ date: endDate }),
      startDate: this.dateTimeService.parseAndFormatDate({ date: startDate }),
    })

    await Promise.all([
      ctx.telegram.sendMessage(
        userProfile.telegramId,
        VerifyClientSceneHelper.getClientInfoMessage({ endDate, passTemplate, startDate, userProfile }),
        {
          parse_mode: 'HTML',
          ...ClientKeyboards.mainMenu(),
        },
      ),
      ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.COMPLETE, AdminKeyboards.mainMenu()),
    ])

    return ctx.scene.leave()
  }
}
