import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { SceneHelper, BotHelper, RegexHelper } from '@app/bot/helpers'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { PATTERNS_COMMON, PATTERNS_SCENE } from '@app/bot/static/patterns'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { AdminKeyboards, ClientKeyboards } from '@app/bot/modules/keyboard/storage'
import { PassTemplateService } from '@app/domain/pass-template/pass-template.service'
import { CommonSceneKeyboards, VerifyClientSceneKeyboards } from '@app/bot/modules/keyboard/storage/scene-keyboards'
import { PassTemplateTypeEnum } from '@app/libs'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { IVerifyClientSceneState, VerifyClientSceneHelper } from './verify-client.scene-helper'
import { UserProfileService } from '@app/domain/user-profile'

@Injectable()
export class VerifyClientScene extends Scenes.WizardScene<BotContext> {
  private readonly verifyClientScene = new SceneHelper<IVerifyClientSceneState>()

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly passTemplateService: PassTemplateService,
    private readonly userProfileService: UserProfileService,
  ) {
    super(
      SCENES.VERIFY_CLIENT,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.passTypeAndTemplateHandler(ctx),
      (ctx) => this.completeHandler(ctx),
    )

    this.hears(PATTERNS_COMMON.EXIT, async (ctx) => {
      await ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.EXIT, AdminKeyboards.mainMenu())
      return ctx.scene.leave()
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    try {
      const todayDateString = this.dateTimeProvider.formatDateStringInTz(new Date().toISOString(), 'yyyy-MM-dd')
      this.verifyClientScene.setState(ctx, { saleDate: todayDateString })

      await ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.SELECT_PASS_TYPE, VerifyClientSceneKeyboards.passType())
      return ctx.wizard.next()
    } catch (error) {
      await this.handleError(ctx, error, 'Failed to initialize verification scene')
    }
  }

  private passTypeAndTemplateHandler = async (ctx: BotContext) => {
    try {
      const data = BotHelper.getUpdatePayload(ctx)
      const textUpdate = BotHelper.isTextUpdate(ctx)

      if (textUpdate) {
        await this.handlePassTypeSelection(ctx, data)
      } else {
        await this.handlePassTemplateAction(ctx, data)
      }
    } catch (error) {
      await this.handleError(ctx, error, 'Failed to process pass template selection')
    }
  }

  private completeHandler = async (ctx: BotContext) => {
    try {
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

      if (data !== PATTERNS_COMMON.CONFIRM) {
        return
      }

      const { saleDate, passTemplate, userProfile } = this.verifyClientScene.getState(ctx) as IVerifyClientSceneState

      await this.userProfileService.verifyClient({
        userProfile,
        passTemplate,
        saleDate,
      })

      await Promise.all([
        ctx.telegram.sendMessage(
          userProfile.telegramId,
          VerifyClientSceneHelper.getClientInfoMessage({ saleDate, passTemplate, userProfile }),
          {
            parse_mode: 'HTML',
            ...ClientKeyboards.mainMenu(),
          },
        ),
        ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.COMPLETE, AdminKeyboards.mainMenu()),
      ])

      return ctx.scene.leave()
    } catch (error) {
      await this.handleError(ctx, error, 'Failed to complete verification')
    }
  }

  private async handlePassTypeSelection(ctx: BotContext, data: string) {
    let passType: PassTemplateTypeEnum

    switch (data) {
      case PATTERNS_SCENE.VERIFY_CLIENT.GROUP_PASS_TYPE:
        passType = PassTemplateTypeEnum.GROUP
        break
      case PATTERNS_SCENE.VERIFY_CLIENT.INDIVIDUAL_PASS_TYPE:
        passType = PassTemplateTypeEnum.INDIVIDUAL
        break
      default:
        return
    }

    const result = await this.passTemplateService.getAll()
    const filteredTemplates = result.filter((template) => template.type === passType)

    if (!filteredTemplates.length) {
      await ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.NO_PASS_TEMPLATES)
      return ctx.scene.leave()
    }

    await ctx.replyWithHTML(
      MESSAGES_SCENE.VERIFY_CLIENT.SELECT_PASS,
      VerifyClientSceneKeyboards.passTemplatePreviewInlineKeyboard(filteredTemplates),
    )
  }

  private async handlePassTemplateAction(ctx: BotContext, data: string) {
    const previewTemplateActionMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.VERIFY_CLIENT.PASS_TEMPLATE_PREVIEW, data)
    const selectTemplateActionMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.VERIFY_CLIENT.PASS_TEMPLATE_SELECT, data)

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

          ctx.answerCbQuery(
            `Клієнт не відповідає віковим обмеженням для цього абонементу.\n\nВік: ${age} років\nВікові обмеження: ${ageRangeText}`,
            { show_alert: true },
          )
          return ctx.deleteMessage()
        }
      }

      ctx.answerCbQuery()
      this.verifyClientScene.setState(ctx, { passTemplate: passTemplateData })

      const state = this.verifyClientScene.getState(ctx) as IVerifyClientSceneState
      const text = VerifyClientSceneHelper.getInfoMessageForConfirm(state)

      await ctx.replyWithHTML(text, CommonSceneKeyboards.confirm())
      return ctx.wizard.next()
    }
  }

  private async handleError(ctx: BotContext, error: any, message: string) {
    console.error(`${message}:`, error)
    await ctx.replyWithHTML(`❌ Виникла помилка: ${message}. Спробуйте ще раз або зверніться до адміністратора.`)
    return ctx.scene.leave()
  }
}
