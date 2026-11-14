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
import { AuditLogActions, AuditLogTrigger, DATE_FORMAT, PassGroupModeEnum, PassStatusEnum, PassTemplateTypeEnum } from '@app/libs'
import { IPassOpenSceneState, PassOpenSceneHelper } from './pass-open.scene-helper'
import { PassTemplateService } from '@app/domain/pass-template'
import { PassSelectionHelper, PassService } from '@app/domain/pass'
import { TrainingSignupService } from '@app/domain/training-signup'
import { GroupService } from '@app/domain/group'
import { GroupAgeRestrictionService } from '@app/domain/group-age-restriction'
import { UserProfileService } from '@app/domain/user-profile'

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
    private readonly groupService: GroupService,
    private readonly groupAgeRestrictionService: GroupAgeRestrictionService,
    private readonly userProfileService: UserProfileService,
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
      const groupSelectActionMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.PASS.GROUP_SELECT, textPayload)
      const backFromGroupActionMatch = textPayload === CALLBACK_PREFIX.SCENES.PASS.GROUP_BACK
      const showAllGroupsActionMatch = textPayload === CALLBACK_PREFIX.SCENES.PASS.GROUP_SHOW_ALL
      const groupDoneActionMatch = textPayload === CALLBACK_PREFIX.SCENES.PASS.GROUP_DONE

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
        case !!groupSelectActionMatch: {
          const [groupId] = groupSelectActionMatch
          return this.handleGroupSelectAction(ctx, Number(groupId))
        }
        case showAllGroupsActionMatch: {
          return this.handleShowAllGroupsAction(ctx)
        }
        case groupDoneActionMatch: {
          return this.handleGroupDoneAction(ctx)
        }
        case !!backFromGroupActionMatch: {
          BotHelper.safeAnswerCbQuery(ctx)
          return this.renderPassTemplateSelectMenu(ctx)
        }
        default:
          // Unknown or stale button: answer it so Telegram doesn't keep showing a spinner
          return BotHelper.safeAnswerCbQuery(ctx)
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
    const { selectedPassType, userProfile } = this.scene.getState(ctx)
    const age = userProfile?.dateOfBirth ? this.dateTimeProvider.getAgeFromBirthday(userProfile.dateOfBirth) : null

    const result = await this.passTemplateService.getAll()
    // Templates outside the client's age (BABY for an adult) aren't offered
    const filteredTemplates = result.filter(
      (template) => template.type === selectedPassType && !PassHelper.getTemplateAgeMismatch(template.passTemplateAgeRestriction, age),
    )

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

    // A button from an old list: refused with an alert, the scene stays on the template list
    // todo: handle exeption passTemplateAgeRestrictionExeptions
    const age = userProfile?.dateOfBirth ? this.dateTimeProvider.getAgeFromBirthday(userProfile.dateOfBirth) : null
    const ageRange = PassHelper.getTemplateAgeMismatch(passTemplateData.passTemplateAgeRestriction, age)
    if (ageRange) {
      await BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.PASS_OPEN.TEMPLATE_AGE_MISMATCH(PassHelper.formatAge(age!), ageRange), {
        show_alert: true,
      })
      return this.renderPassTemplateSelectMenu(ctx)
    }

    BotHelper.safeAnswerCbQuery(ctx)

    this.scene.setState(ctx, {
      passTemplate: passTemplateData,
      groupIds: [],
      groupNames: [],
      showAllGroups: false,
      ageExceptionIds: [],
    })

    if (passTemplateData.type === PassTemplateTypeEnum.GROUP && passTemplateData.groupMode === PassGroupModeEnum.FIXED) {
      if (passTemplateData.multiGroup) {
        // PRO renewal: the groups of the client's current FIXED pass start ticked
        const currentPass = await this.passService.getCurrentPass(userProfile.client.id)
        if (currentPass?.groupMode === PassGroupModeEnum.FIXED) {
          await this.setPickedGroups(ctx, PassSelectionHelper.getGroupIds(currentPass))
        }
      }
      return this.renderGroupSelectMenu(ctx)
    }
    return this.renderConfirmMenu(ctx)
  }

  /**
   * FIXED group pass: the group it is bound to. The client's current pass's group (a renewal) is first and green;
   * groups for the client's age, or all active ones when none fits. "👀 Показати всі групи" lists every active group
   * (a group outside the client's age gets an exception when the pass is opened).
   */
  private renderGroupSelectMenu = async (ctx: BotContext) => {
    const { userProfile, showAllGroups, passTemplate, groupIds = [] } = this.scene.getState(ctx)
    const [{ groups, isAgeFiltered }, currentPass] = await Promise.all([
      this.getSelectableGroups(ctx),
      this.passService.getCurrentPass(userProfile.client.id),
    ])
    const suggestedGroupId = currentPass?.groupMode === PassGroupModeEnum.FIXED ? (PassSelectionHelper.getGroupIds(currentPass)[0] ?? null) : null
    const message = showAllGroups
      ? MESSAGES_SCENE.PASS_GROUP.SELECT_ANY
      : isAgeFiltered
        ? MESSAGES_SCENE.PASS_GROUP.SELECT
        : MESSAGES_SCENE.PASS_GROUP.SELECT_ALL

    return BotHelper.safeEditMessageText(
      ctx,
      passTemplate.multiGroup ? message + MESSAGES_SCENE.PASS_GROUP.MULTI_HINT : message,
      PassRelatedKeyboards.passGroupSelectInlineKeyboard(groups, {
        suggestedGroupId,
        backCallbackData: CALLBACK_PREFIX.SCENES.PASS.GROUP_BACK,
        showAllCallbackData: isAgeFiltered ? CALLBACK_PREFIX.SCENES.PASS.GROUP_SHOW_ALL : undefined,
        ...(passTemplate.multiGroup ? { selectedIds: groupIds, doneCallbackData: CALLBACK_PREFIX.SCENES.PASS.GROUP_DONE } : {}),
      }),
    )
  }

  /** The list the admin picks from: the client's age, or every active group after "👀 Показати всі групи" (admins). */
  private getSelectableGroups = async (ctx: BotContext) => {
    const { userProfile, showAllGroups } = this.scene.getState(ctx)
    return showAllGroups && UserHelper.isAdminRole(ctx)
      ? { groups: await this.groupService.getAllActiveGroups(), isAgeFiltered: false }
      : this.groupService.getGroupsForClientPass(userProfile?.dateOfBirth ?? null)
  }

  /**
   * The picked groups (ids of active studio groups only) with their names, and which of them are outside the client's
   * age (an exception is added for those when the pass is opened).
   */
  private setPickedGroups = async (ctx: BotContext, ids: number[]) => {
    const { userProfile } = this.scene.getState(ctx)
    const [allGroups, ageGroups] = await Promise.all([
      this.groupService.getAllActiveGroups(),
      this.groupService.getAgeAppropriateActiveGroups(userProfile?.dateOfBirth ?? null),
    ])
    const picked = ids.map((id) => allGroups.find((g) => g.id === id)).filter((g) => !!g)
    this.scene.setState(ctx, {
      groupIds: picked.map((g) => g.id),
      groupNames: picked.map((g) => g.name),
      ageExceptionIds: picked.filter((g) => !ageGroups.some((a) => a.id === g.id)).map((g) => g.id),
    })
  }

  private handleGroupDoneAction = async (ctx: BotContext) => {
    const { groupIds = [] } = this.scene.getState(ctx)
    if (!groupIds.length) {
      return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.PASS_GROUP.PICK_ONE, { show_alert: true })
    }
    BotHelper.safeAnswerCbQuery(ctx)
    return this.renderConfirmMenu(ctx)
  }

  private handleShowAllGroupsAction = async (ctx: BotContext) => {
    if (!UserHelper.isAdminRole(ctx)) {
      return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.PASS_GROUP.HINT, { show_alert: true })
    }
    BotHelper.safeAnswerCbQuery(ctx)
    this.scene.setState(ctx, { showAllGroups: true })
    return this.renderGroupSelectMenu(ctx)
  }

  /** One group: picked → confirm. PRO (multi_group): toggles the group (✅) and stays on the list until "Готово". */
  private handleGroupSelectAction = async (ctx: BotContext, groupId: number) => {
    // Re-checked: the button may be from an old list
    const { groups } = await this.getSelectableGroups(ctx)
    const group = groups.find((g) => g.id === groupId)

    if (!group) {
      return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.PASS_GROUP.HINT, { show_alert: true })
    }

    BotHelper.safeAnswerCbQuery(ctx)
    const { passTemplate, groupIds = [] } = this.scene.getState(ctx)

    if (!passTemplate.multiGroup) {
      await this.setPickedGroups(ctx, [group.id])
      return this.renderConfirmMenu(ctx)
    }

    await this.setPickedGroups(ctx, groupIds.includes(group.id) ? groupIds.filter((id) => id !== group.id) : [...groupIds, group.id])
    return this.renderGroupSelectMenu(ctx)
  }

  private handlePassOpenConfirmAction = async (ctx: BotContext) => {
    try {
      const state = this.scene.getState(ctx)
      const { userProfile, saleDate, passTemplate, mainMessageId, startMessageId, groupIds = [], ageExceptionIds = [] } = state
      const isFixedGroupPass = passTemplate.type === PassTemplateTypeEnum.GROUP && passTemplate.groupMode === PassGroupModeEnum.FIXED

      if (isFixedGroupPass && !groupIds.length) {
        // Stale confirm button from before the group step
        return this.renderGroupSelectMenu(ctx)
      }

      const [newPass, logOperations] = await this.passService.createNewPassForExistingClient(userProfile.client.id, {
        passTemplateId: passTemplate.id,
        saleDate,
        clientId: userProfile.client.id,
        status: PassStatusEnum.ACTIVE,
        availableSlots: passTemplate.length,
        groupMode: passTemplate.groupMode,
        groupIds: isFixedGroupPass ? groupIds : [],
      })

      // Groups outside the client's age: signups there would be refused without an exception
      if (isFixedGroupPass) {
        for (const groupId of ageExceptionIds.filter((id) => groupIds.includes(id))) {
          await this.groupAgeRestrictionService.addException(userProfile.id, groupId)
        }
      }

      AuditLogHelper.startAction(ctx, AuditLogActions.PASS_CREATE, AuditLogTrigger.ADMIN_ACTION, logOperations)

      ctx.deleteMessages([startMessageId, mainMessageId]).catch(() => {})
      this.scene.setState(ctx, { newPassId: newPass.id })

      const { role } = UserHelper.getUser(ctx)
      const keyboard = KeyboardHelper.getRoleBasedMainMenuKeyboard(role)

      await Promise.all([
        ctx.replyWithHTML(`✅ Абонемент успішно відкрито!`, keyboard),
        BotHelper.notifyClient(ctx.telegram, this.userProfileService, userProfile, { text: PassOpenSceneHelper.getClientInfoMessage(state) }),
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

    const [trainingSignups, { passes: activePasses }] = await Promise.all([
      this.trainingSignupService.getTrainingSignupByPassId(pass.id),
      this.passService.findActivePassesByClientId(pass.clientId),
    ])

    await PassHelper.renderPassManageMenu(ctx, this.dateTimeProvider, {
      pass,
      fullName: UserHelper.getDisplayName(userProfile),
      clientUserId: userProfile.id,
      shouldEdit: false,
      trainingSignups,
      activePasses,
    })
  }
}
