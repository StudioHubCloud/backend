import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { API, AuditLogActions, AuditLogTrigger, PassStatusEnum } from '@app/libs'
import { CALLBACK_PREFIX, TPaginatedMenuRenderOptions } from '@app/bot/libs'
import { TrainingSelectPaginatedMenu, GroupSelectPaginatedMenu, ActiveSchedulesPaginatedMenu } from '@app/bot/menus'
import { BotHelper, UserHelper } from '@app/bot/helpers'
import { TrainingSignupService } from '@app/domain/training-signup'
import { GroupService } from '@app/domain/group'
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

    const currentActivePass = client?.pass?.find((p) => p.status === PassStatusEnum.ACTIVE)

    if (!client || !currentActivePass) {
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

    const currentActivePass = client?.pass?.find((p) => p.status === PassStatusEnum.ACTIVE)

    if (isUserClient) {
      if (!client || !currentActivePass) {
        return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_CLIENT.NO_ACTIVE_PASS, { show_alert: true })
      }
      const response = await this.trainingSignupService.signUpForTrainingAsClientViaTelegram({
        trainingId: +trainingId,
        userProfileId: id,
        passId: currentActivePass.id,
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

      switch (response.availableSlots) {
        case 1:
          return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_CLIENT.ONE_SCHEDULE_REMAINING, { show_alert: true })
        default:
          return BotHelper.safeAnswerCbQuery(ctx, response.message, { show_alert: true })
      }
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
    this.groupSelectMenu.initMenu(ctx, { userId: id, role }, renderOptions)
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

    if (!activeSignups?.length && renderOptions?.shouldEdit) {
      return ctx.editMessageText(MESSAGES_CLIENT.NO_ACTIVE_SIGNUPS)
    }

    return this.activeSchedulesPaginatedMenu.initMenu(ctx, { data: activeSignups }, renderOptions)
  }
}
