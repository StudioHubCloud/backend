import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { API, PassStatusEnum } from '@app/libs'
import { CALLBACK_PREFIX, TPaginatedMenuRenderOptions } from '@app/bot/libs'
import { TrainingSelectPaginatedMenu, GroupSelectPaginatedMenu, ActiveSchedulesPaginatedMenu } from '@app/bot/menus'
import { UserHelper } from '@app/bot/helpers'
import { TrainingSignupService } from '@app/domain/training-signup'
import { GroupService } from '@app/domain/group'
import { MESSAGES_CLIENT } from '@app/bot/static/messages'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'

@Injectable()
export class SchedulerComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
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
    this.composer.hears(BUTTON_PATTERNS.ACTIVE_SCHEDULES, this.activeSchedulesHandler)

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

  private activeSchedulesHandler = async (ctx: BotContext) => {
    const { id } = UserHelper.getUser(ctx)
    return this.activeSchedulesPaginatedMenu.initMenu(ctx, { userId: id }, { shouldEdit: false, withExitButton: true })
  }

  private handleGroupSelect = async (ctx: BotContext, groupId: string) => {
    ctx.answerCbQuery()
    const { id, client, role } = UserHelper.getUser(ctx)
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
        return ctx.answerCbQuery(MESSAGES_CLIENT.NO_ACTIVE_PASS, { show_alert: true })
      }
      const response = await this.trainingSignupService.signUpForTrainingAsClientViaTelegram({
        trainingId: +trainingId,
        userProfileId: id,
        passId: currentActivePass.id,
      })

      if (response.status === API.RESPONSE.ERROR_STRING) {
        return ctx.answerCbQuery(response.message, { show_alert: true })
      }

      switch (response.availableSlots) {
        case 1:
          return ctx.answerCbQuery(MESSAGES_CLIENT.ONE_SCHEDULE_REMAINING, { show_alert: true })
        default:
          return ctx.answerCbQuery(response.message, { show_alert: true })
      }
    } else if (isUserGuest) {
      ctx.answerCbQuery()
      //add later for guests
    } else {
      ctx.answerCbQuery()
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
    const { id } = UserHelper.getUser(ctx)

    const response = await this.trainingSignupService.signOutFromTrainingAsClientViaTelegram(signupId)

    if (response.status === API.RESPONSE.ERROR_STRING) {
      return ctx.answerCbQuery(response.message, { show_alert: true })
    }

    ctx.answerCbQuery(response.message, { show_alert: true })
    return this.activeSchedulesPaginatedMenu.initMenu(ctx, { userId: id }, { shouldEdit: true, withExitButton: true })
  }
}
