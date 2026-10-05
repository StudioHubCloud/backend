import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { API, AuditLogActions, AuditLogTrigger, PassGroupModeEnum, PassStatusEnum, PassTemplateTypeEnum } from '@app/libs'
import { CALLBACK_PREFIX, TPaginatedMenuRenderOptions } from '@app/bot/libs'
import { TrainingSelectPaginatedMenu, GroupSelectPaginatedMenu, ActiveSchedulesPaginatedMenu } from '@app/bot/menus'
import { BotHelper, PersonalTrainingHelper, UserHelper } from '@app/bot/helpers'
import { TrainingSignupService } from '@app/domain/training-signup'
import { GroupService } from '@app/domain/group'
import { PassService } from '@app/domain/pass'
import { PersonalTrainingSignupService } from '@app/domain/personal-training-signup'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { MESSAGES_CLIENT } from '@app/bot/static/messages'
import { AuditLogHelper } from '@app/bot/helpers/audit-log.helper'

@Injectable()
export class SchedulerComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    private readonly groupSelectMenu: GroupSelectPaginatedMenu,
    private readonly trainingSelectMenu: TrainingSelectPaginatedMenu,
    private readonly activeSchedulesPaginatedMenu: ActiveSchedulesPaginatedMenu,
    private readonly trainingSignupService: TrainingSignupService,
    private readonly groupService: GroupService,
    private readonly passService: PassService,
    private readonly personalTrainingSignupService: PersonalTrainingSignupService,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    this.composer = new Composer<BotContext>()

    this.configureMenus()

    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  private initComposerHandlers() {
    this.composer.hears(BUTTON_PATTERNS.ACTIVE_SCHEDULES, async (ctx: BotContext) => {
      return this.renderActiveSchedulesMenu(ctx, { shouldEdit: false, withExitButton: true })
    })

    this.composer.hears(BUTTON_PATTERNS.SCHEDULE, async (ctx) => {
      return this.renderGroupSelectMenu(ctx, { shouldEdit: false, withExitButton: true })
    })
    this.composer.action(CALLBACK_PREFIX.CLIENT.GROUP.BACK_TO_SELECT, async (ctx) => {
      return this.renderGroupSelectMenu(ctx, { shouldEdit: true, withExitButton: true })
    })
  }

  private configureMenus() {
    this.composer.use(
      this.groupSelectMenu.middleware({
        callbackPrefix: CALLBACK_PREFIX.CLIENT.GROUP.SELECT,
        promptMessage: MESSAGES_CLIENT.CHOOSE_GROUP,
        noOptionsMessage: MESSAGES_CLIENT.NO_GROUPS,
        onItemSelect: this.handleGroupSelect,
      }),
    )
    this.composer.use(
      this.trainingSelectMenu.middleware({
        callbackPrefix: CALLBACK_PREFIX.CLIENT.TRAINING.SELECT,
        promptMessage: MESSAGES_CLIENT.CHOOSE_TRAINING,
        noOptionsMessage: MESSAGES_CLIENT.NO_TRAININGS,
        onItemSelect: this.handleTrainingSelect,
      }),
    )

    this.composer.use(
      this.activeSchedulesPaginatedMenu.middleware({
        callbackPrefix: CALLBACK_PREFIX.CLIENT.TRAINING.SIGN_OUT,
        promptMessage: MESSAGES_CLIENT.ACTIVE_SIGNUPS,
        noOptionsMessage: MESSAGES_CLIENT.NO_ACTIVE_SIGNUPS,
        onItemSelect: this.handleSignOutAction,
      }),
    )
  }

  private handleGroupSelect = async (ctx: BotContext, groupId: string) => {
    const { id, client, role } = UserHelper.getUser(ctx)

    const hasActivePass = !!client?.pass?.some((p) => p.status === PassStatusEnum.ACTIVE)

    if (!client || !hasActivePass) {
      return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_CLIENT.NO_ACTIVE_PASS, { show_alert: true })
    }

    const group = await this.groupService.getGroupById(+groupId)
    const backButtonCallbackData = CALLBACK_PREFIX.CLIENT.GROUP.BACK_TO_SELECT
    return this.trainingSelectMenu.initMenu(
      ctx,
      { group, clientId: client?.id, userId: id, role },
      { shouldEdit: true, backButtonCallbackData, withExitButton: true },
    )
  }

  private handleTrainingSelect = async (ctx: BotContext, trainingId: string) => {
    const { id, client, role } = UserHelper.getUser(ctx)
    const isUserClient = UserHelper.isClientRole(role) // change it later to include guests
    const isUserGuest = UserHelper.isGuestRole(ctx)

    const hasActivePass = !!client?.pass?.some((p) => p.status === PassStatusEnum.ACTIVE)

    if (isUserClient) {
      if (!client || !hasActivePass) {
        return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_CLIENT.NO_ACTIVE_PASS, { show_alert: true })
      }
      const response = await this.trainingSignupService.signUpForTrainingAsClientViaTelegram({
        trainingId: +trainingId,
        userProfileId: id,
        clientId: client.id,
      })

      if (response.status === API.RESPONSE.ERROR_STRING) {
        return BotHelper.safeAnswerCbQuery(ctx, response.message, { show_alert: true })
      }

      AuditLogHelper.startAction(
        ctx,
        AuditLogActions.TRAINING_SIGNUP_CREATE,
        AuditLogTrigger.CLIENT_ACTION,
        response.data?.logOperations,
      )

      const successMessage = response.availableSlots === 1 ? MESSAGES_CLIENT.ONE_SCHEDULE_REMAINING : response.message
      await BotHelper.safeAnswerCbQuery(ctx, successMessage, { show_alert: true })

      // Paid by a pass other than the current one: say which (too long for the 200-char alert)
      if (response.passNote) {
        await ctx.reply(response.passNote)
      }
      return
    } else if (isUserGuest) {
      BotHelper.safeAnswerCbQuery(ctx)
      //add later for guests
    } else {
      BotHelper.safeAnswerCbQuery(ctx)
    }
  }

  private renderGroupSelectMenu = async (
    ctx: BotContext,
    renderOptions: TPaginatedMenuRenderOptions = { withExitButton: true },
  ) => {
    const { id, role } = UserHelper.getUser(ctx)

    // Main guard: an individual pass is booked with the trainer, so there is nothing to browse here.
    // TrainingSignupService keeps the same check as a backup at signup time.
    if (await this.hasActiveIndividualPass(ctx)) {
      const { isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)
      return isCallbackQueryUpdate
        ? BotHelper.safeAnswerCbQuery(ctx, MESSAGES_CLIENT.INDIVIDUAL_PASS_NO_GROUP_SIGNUP, { show_alert: true })
        : ctx.reply(MESSAGES_CLIENT.INDIVIDUAL_PASS_NO_GROUP_SIGNUP)
    }

    return this.groupSelectMenu.initMenu(ctx, { userId: id, role, highlightGroupIds: await this.getOwnGroupIds(ctx) }, renderOptions)
  }

  /** Groups of the client's active FIXED passes, the current pass's group first ("Розклад": first and green). */
  private getOwnGroupIds = async (ctx: BotContext): Promise<number[]> => {
    const { role, client } = UserHelper.getUser(ctx)

    if (!UserHelper.isClientRole(role) || !client) {
      return []
    }

    const { passes } = await this.passService.findActivePassesByClientId(client.id)
    const currentPass = await this.passService.getCurrentPass(client.id)
    const groupIds = passes
      .filter((pass) => pass.groupMode === PassGroupModeEnum.FIXED && pass.groupId !== null)
      .sort((a, b) => Number(b.id === currentPass?.id) - Number(a.id === currentPass?.id))
      .map((pass) => pass.groupId!)
    return [...new Set(groupIds)]
  }

  private handleSignOutAction = async (ctx: BotContext) => {
    const signupId = ctx['match'][1]

    const response = await this.trainingSignupService.signOutFromTrainingAsClientViaTelegram(signupId)

    if (response.status === API.RESPONSE.ERROR_STRING) {
      return BotHelper.safeAnswerCbQuery(ctx, response.message, { show_alert: true })
    }

    BotHelper.safeAnswerCbQuery(ctx, response.message, { show_alert: true })

    return this.renderActiveSchedulesMenu(ctx, { shouldEdit: true, withExitButton: true })
  }

  private renderActiveSchedulesMenu = async (
    ctx: BotContext,
    renderOptions: TPaginatedMenuRenderOptions = { withExitButton: true, shouldEdit: false },
  ) => {
    const { id } = UserHelper.getUser(ctx)

    const activeSignups = await this.trainingSignupService.getClientSignups(id)

    if (!activeSignups?.length) {
      // An individual pass can't sign up for groups: its "active signups" are the planned individual sessions
      const emptyMessage = (await this.hasActiveIndividualPass(ctx))
        ? await this.getIndividualSessionsMessage(ctx)
        : MESSAGES_CLIENT.NO_ACTIVE_SIGNUPS

      return renderOptions?.shouldEdit
        ? BotHelper.safeEditMessageText(ctx, emptyMessage)
        : ctx.reply(emptyMessage, { parse_mode: 'HTML' })
    }

    return this.activeSchedulesPaginatedMenu.initMenu(ctx, { data: activeSignups }, renderOptions)
  }

  private getIndividualSessionsMessage = async (ctx: BotContext): Promise<string> => {
    const { client } = UserHelper.getUser(ctx)

    if (!client) {
      return MESSAGES_CLIENT.NO_ACTIVE_SIGNUPS_INDIVIDUAL
    }

    const signups = await this.personalTrainingSignupService.getClientSignups(client.id)
    return (
      PersonalTrainingHelper.getClientUpcomingMessage(signups, this.dateTimeProvider) ??
      MESSAGES_CLIENT.NO_ACTIVE_SIGNUPS_INDIVIDUAL
    )
  }

  /** Only an individual pass (no active group pass next to it): there are no group trainings to sign up for. */
  private hasActiveIndividualPass = async (ctx: BotContext): Promise<boolean> => {
    const { role, client } = UserHelper.getUser(ctx)

    if (!UserHelper.isClientRole(role) || !client) {
      return false
    }

    const { passes } = await this.passService.findActivePassesByClientId(client.id)
    const types = passes.map((pass) => pass.passTemplate.type)
    return types.includes(PassTemplateTypeEnum.INDIVIDUAL) && !types.includes(PassTemplateTypeEnum.GROUP)
  }
}
