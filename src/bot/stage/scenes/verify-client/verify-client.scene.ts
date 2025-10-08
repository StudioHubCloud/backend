import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { SceneHelper, BotHelper, RegexHelper, UserHelper, KeyboardHelper } from '@app/bot/helpers'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { ClientKeyboards } from '@app/bot/keyboard/storage'
import { PassTemplateService } from '@app/domain/pass-template/pass-template.service'
import { CommonSceneKeyboards, PassRelatedKeyboards } from '@app/bot/keyboard/storage/scene-keyboards'
import { DATE_FORMAT, PassTemplateTypeEnum } from '@app/libs'
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

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      const { role } = UserHelper.getUser(ctx)
      const keyboard = KeyboardHelper.getRoleBasedMainMenuKeyboard(role)
      await ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.EXIT, keyboard)
      return ctx.scene.leave()
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    try {
      const todayDateString = this.dateTimeProvider.formatDateStringInTz(new Date().toISOString(), DATE_FORMAT.DATE_MAIN)
      this.verifyClientScene.setState(ctx, { saleDate: todayDateString })

      await ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.SELECT_PASS_TYPE, PassRelatedKeyboards.passType())
      return ctx.wizard.next()
    } catch (error) {
      await this.handleError(ctx, error, 'Failed to initialize verification scene')
    }
  }

  private passTypeAndTemplateHandler = async (ctx: BotContext) => {
    try {
      const { textPayload, isTextUpdate } = BotHelper.getUpdatePayload(ctx)

      if (isTextUpdate) {
        await this.handlePassTypeSelection(ctx, textPayload)
      } else {
        await this.handlePassTemplateAction(ctx, textPayload)
      }
    } catch (error) {
      await this.handleError(ctx, error, 'Failed to process pass template selection')
    }
  }

  private completeHandler = async (ctx: BotContext) => {
    try {
      const { textPayload, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

      if (isCallbackQueryUpdate) {
        return BotHelper.safeAnswerCbQuery(ctx)
      }

      switch (textPayload) {
        case BUTTON_PATTERNS.BACK:
          await ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.SELECT_PASS_TYPE, PassRelatedKeyboards.passType())
          return ctx.wizard.back()

        default:
          break
      }

      if (textPayload !== BUTTON_PATTERNS.CONFIRM) {
        return
      }

      const { saleDate, passTemplate, userProfile } = this.verifyClientScene.getState(ctx) as IVerifyClientSceneState

      await this.userProfileService.verifyClient({
        userProfile,
        passTemplate,
        saleDate,
      })

      const { role } = UserHelper.getUser(ctx)
      const keyboard = KeyboardHelper.getRoleBasedMainMenuKeyboard(role)

      await Promise.all([
        BotHelper.safeSendMessage(
          ctx,
          userProfile.telegramId,
          VerifyClientSceneHelper.getClientInfoMessage({ saleDate, passTemplate, userProfile }),
          {
            parse_mode: 'HTML',
            ...ClientKeyboards.mainMenu(),
          },
        ),
        ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.COMPLETE, keyboard),
      ])

      return ctx.scene.leave()
    } catch (error) {
      await this.handleError(ctx, error, 'Failed to complete verification')
    }
  }

  private async handlePassTypeSelection(ctx: BotContext, data: string) {
    let passType: PassTemplateTypeEnum

    switch (data) {
      case BUTTON_PATTERNS.GROUP_PASS_TYPE:
        passType = PassTemplateTypeEnum.GROUP
        break
      case BUTTON_PATTERNS.INDIVIDUAL_PASS_TYPE:
        passType = PassTemplateTypeEnum.INDIVIDUAL
        break
      default:
        return
    }

    const result = await this.passTemplateService.getAll()
    const filteredTemplates = result.filter((template) => template.type === passType)

    if (!filteredTemplates.length) {
      return await ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.NO_PASS_TEMPLATES)
    }

    await ctx.replyWithHTML(
      MESSAGES_SCENE.VERIFY_CLIENT.SELECT_PASS,
      PassRelatedKeyboards.passTemplatePreviewInlineKeyboard(filteredTemplates),
    )
  }

  private async handlePassTemplateAction(ctx: BotContext, data: string) {
    const previewTemplateActionMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.PASS.TEMPLATE_DETAILS, data)
    const selectTemplateActionMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.PASS.TEMPLATE_SELECT, data)

    if (previewTemplateActionMatch) {
      BotHelper.safeAnswerCbQuery(ctx)
      const [id] = previewTemplateActionMatch
      const passTemplateData = await this.passTemplateService.getById(id)
      return ctx.replyWithHTML(
        MessageHelper.constructPassSelectMessage(passTemplateData),
        PassRelatedKeyboards.passTemplateSelectInlineKeyboard(id),
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

          BotHelper.safeAnswerCbQuery(
            ctx,
            `Клієнт не відповідає віковим обмеженням для цього абонементу.\n\nВік: ${age} років\nВікові обмеження: ${ageRangeText}`,
            { show_alert: true },
          )
          return ctx.deleteMessage()
        }
      }

      BotHelper.safeAnswerCbQuery(ctx)
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
