import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { SceneHelper, BotHelper, RegexHelper, UserHelper, KeyboardHelper, TextHelper } from '@app/bot/helpers'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { ClientKeyboards } from '@app/bot/keyboard/storage'
import { PassTemplateService } from '@app/domain/pass-template/pass-template.service'
import { CommonSceneKeyboards, PassRelatedKeyboards } from '@app/bot/keyboard/storage/scene-keyboards'
import { AuditLogActions, AuditLogTrigger, DATE_FORMAT, PassGroupModeEnum, PassTemplateTypeEnum } from '@app/libs'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { IVerifyClientSceneState, VerifyClientSceneHelper } from './verify-client.scene-helper'
import { UserProfileService } from '@app/domain/user-profile'
import { GroupService } from '@app/domain/group'
import { AuditLogHelper } from '@app/bot/helpers/audit-log.helper'

// Wizard steps: 0 enter, 1 pass type and template, 2 group (FIXED group pass), 3 confirmation
const PASS_TYPE_STEP = 1
const GROUP_STEP = 2
const COMPLETE_STEP = 3

@Injectable()
export class VerifyClientScene extends Scenes.WizardScene<BotContext> {
  private readonly verifyClientScene = new SceneHelper<IVerifyClientSceneState>()

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly passTemplateService: PassTemplateService,
    private readonly userProfileService: UserProfileService,
    private readonly groupService: GroupService,
  ) {
    super(
      SCENES.VERIFY_CLIENT,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.passTypeAndTemplateHandler(ctx),
      (ctx) => this.groupHandler(ctx),
      (ctx) => this.completeHandler(ctx),
    )

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      await this.deleteGroupList(ctx)
      const { role } = UserHelper.getUser(ctx)
      const keyboard = KeyboardHelper.getRoleBasedMainMenuKeyboard(role)
      await ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.EXIT, keyboard)
      return ctx.scene.leave()
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    try {
      const todayDateString = this.dateTimeProvider.formatDateStringInTz(new Date().toISOString(), DATE_FORMAT.DATE_MAIN)
      // The group the client picked at registration is suggested (first, green) for a FIXED pass
      const { userProfile } = this.verifyClientScene.getState(ctx)
      const registerRequest = userProfile ? await this.userProfileService.getRegisterRequest(userProfile.id) : null
      this.verifyClientScene.setState(ctx, { saleDate: todayDateString, suggestedGroupId: registerRequest?.groupId ?? null })

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
          return ctx.wizard.selectStep(PASS_TYPE_STEP)

        default:
          break
      }

      if (textPayload !== BUTTON_PATTERNS.CONFIRM) {
        return
      }

      const state = this.verifyClientScene.getState(ctx) as IVerifyClientSceneState
      const { saleDate, passTemplate, userProfile, groupId } = state

      const [_, logOperations] = await this.userProfileService.verifyClient({
        userProfile,
        passTemplate,
        saleDate,
        groupId,
      })

      AuditLogHelper.startAction(ctx, AuditLogActions.CLIENT_VERIFY_CONFIRM, AuditLogTrigger.ADMIN_ACTION, logOperations)

      const { role } = UserHelper.getUser(ctx)
      const keyboard = KeyboardHelper.getRoleBasedMainMenuKeyboard(role)

      await Promise.all([
        BotHelper.safeSendMessage(
          ctx.telegram,
          userProfile.telegramId,
          VerifyClientSceneHelper.getClientInfoMessage(state),
          {
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
      PassRelatedKeyboards.passTemplatePreviewInlineKeyboard(filteredTemplates, BUTTON_PATTERNS.CLOSE),
    )
  }

  private async handlePassTemplateAction(ctx: BotContext, data: string) {
    const previewTemplateActionMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.PASS.TEMPLATE_DETAILS, data)
    const selectTemplateActionMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.PASS.TEMPLATE_SELECT, data)
    const backToTemplateListActionMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.PASS.BACK_TO_LIST, data)

    // Both buttons are labelled "✖️ Закрити" here: each list/details is its own message, and the
    // pass-type reply keyboard stays visible, so closing just removes the message
    if (data === CALLBACK_PREFIX.SCENES.PASS.BACK_TO_TYPE_SELECT || backToTemplateListActionMatch) {
      BotHelper.safeAnswerCbQuery(ctx)
      return BotHelper.safeDeleteMessage(ctx)
    }

    if (previewTemplateActionMatch) {
      BotHelper.safeAnswerCbQuery(ctx)
      const [id] = previewTemplateActionMatch
      const passTemplateData = await this.passTemplateService.getById(id)
      return ctx.replyWithHTML(
        MessageHelper.constructPassSelectMessage(passTemplateData),
        PassRelatedKeyboards.passTemplateSelectInlineKeyboard(id, BUTTON_PATTERNS.CLOSE),
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
          return BotHelper.safeDeleteMessage(ctx)
        }
      }

      BotHelper.safeAnswerCbQuery(ctx)
      this.verifyClientScene.setState(ctx, { passTemplate: passTemplateData, groupId: null, groupName: undefined })

      const isFixedGroupPass =
        passTemplateData.type === PassTemplateTypeEnum.GROUP && passTemplateData.groupMode === PassGroupModeEnum.FIXED

      if (isFixedGroupPass) {
        await this.renderGroupList(ctx)
        return ctx.wizard.selectStep(GROUP_STEP)
      }

      return this.renderConfirm(ctx)
    }

    // Unknown or stale button: answer it so Telegram doesn't keep showing a spinner
    return BotHelper.safeAnswerCbQuery(ctx)
  }

  /** FIXED group pass: the group it is bound to. The list's "⬅️ Назад" returns to the pass templates. */
  private groupHandler = async (ctx: BotContext) => {
    try {
      const { textPayload, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

      if (!isCallbackQueryUpdate) {
        return ctx.replyWithHTML(MESSAGES_SCENE.PASS_GROUP.HINT)
      }

      if (textPayload === CALLBACK_PREFIX.SCENES.PASS.GROUP_BACK) {
        BotHelper.safeAnswerCbQuery(ctx)
        await this.deleteGroupList(ctx)
        return ctx.wizard.selectStep(PASS_TYPE_STEP)
      }

      const groupSelectMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.PASS.GROUP_SELECT, textPayload)
      if (!groupSelectMatch) {
        return BotHelper.safeAnswerCbQuery(ctx)
      }

      // Re-checked: the button may be from an old list
      const [groupId] = groupSelectMatch
      const { groups } = await this.getGroupsForClient(ctx)
      const group = groups.find((g) => g.id === Number(groupId))
      if (!group) {
        return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.PASS_GROUP.HINT, { show_alert: true })
      }

      BotHelper.safeAnswerCbQuery(ctx)
      this.verifyClientScene.setState(ctx, { groupId: group.id, groupName: group.name })
      const { groupListMessageId } = this.verifyClientScene.getState(ctx)
      if (groupListMessageId) {
        await BotHelper.safeEditMessageTextById(
          ctx,
          ctx.chat?.id,
          groupListMessageId,
          `👯‍♀️ Група: ${TextHelper.bold(TextHelper.escapeHtml(group.name))}`,
        )
      }
      this.verifyClientScene.setState(ctx, { groupListMessageId: null })

      return this.renderConfirm(ctx)
    } catch (error) {
      await this.handleError(ctx, error, 'Failed to process group selection')
    }
  }

  private async renderConfirm(ctx: BotContext) {
    const state = this.verifyClientScene.getState(ctx) as IVerifyClientSceneState
    await ctx.replyWithHTML(VerifyClientSceneHelper.getInfoMessageForConfirm(state), CommonSceneKeyboards.confirm())
    return ctx.wizard.selectStep(COMPLETE_STEP)
  }

  /** Groups for the client's age, the registration pick first and green; all active groups if none fits the age. */
  private async renderGroupList(ctx: BotContext) {
    const { groups, isAgeFiltered } = await this.getGroupsForClient(ctx)
    const { suggestedGroupId } = this.verifyClientScene.getState(ctx)
    const message = await ctx.replyWithHTML(
      isAgeFiltered ? MESSAGES_SCENE.PASS_GROUP.SELECT : MESSAGES_SCENE.PASS_GROUP.SELECT_ALL,
      PassRelatedKeyboards.passGroupSelectInlineKeyboard(groups, {
        suggestedGroupId,
        backCallbackData: CALLBACK_PREFIX.SCENES.PASS.GROUP_BACK,
      }),
    )
    this.verifyClientScene.setState(ctx, { groupListMessageId: message.message_id })
  }

  private async getGroupsForClient(ctx: BotContext) {
    const { userProfile } = this.verifyClientScene.getState(ctx)
    return this.groupService.getGroupsForClientPass(userProfile?.dateOfBirth ?? null)
  }

  /** "Вийти" / "⬅️ Назад": the open group list would stay with dead buttons, so it goes away. */
  private async deleteGroupList(ctx: BotContext) {
    const { groupListMessageId } = this.verifyClientScene.getState(ctx)
    if (groupListMessageId && ctx.chat) {
      await ctx.telegram.deleteMessage(ctx.chat.id, groupListMessageId).catch(() => {})
    }
    this.verifyClientScene.setState(ctx, { groupListMessageId: null })
  }

  private async handleError(ctx: BotContext, error: any, message: string) {
    console.error(`${message}:`, error)
    await ctx.replyWithHTML(`❌ Виникла помилка: ${message}. Спробуйте ще раз або зверніться до адміністратора.`)
    return ctx.scene.leave()
  } 
}
