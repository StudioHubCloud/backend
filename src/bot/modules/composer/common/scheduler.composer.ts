import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { PATTERNS_CLIENT, PATTERNS_COMMON } from '@app/bot/static/patterns'
import { API, PassStatusEnum } from '@app/libs'
import { CALLBACK_PREFIX } from '@app/bot/libs'
import { TrainingSelectPaginatedMenu, GroupSelectPaginatedMenu, ActiveSchedulesInlineMenu } from '@app/bot/modules/inline-menu'
import { UserHelper } from '@app/bot/helpers'
import { TrainingSignupService } from '@app/domain/training-signup'
import { GroupService } from '@app/domain/group'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { MESSAGES_CLIENT } from '@app/bot/static/messages'

@Injectable()
export class SchedulerComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    private readonly groupSelectMenu: GroupSelectPaginatedMenu,
    private readonly trainingSelectMenu: TrainingSelectPaginatedMenu,
    private readonly trainingSignupService: TrainingSignupService,
    private readonly activeSchedulesMenu: ActiveSchedulesInlineMenu,
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
    this.composer.hears(PATTERNS_COMMON.SCHEDULE, this.trainingScheduleHandler)
    this.composer.hears(PATTERNS_CLIENT.ACTIVE_SCHEDULES, this.activeSchedulesHandler)
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
    this.composer.use(this.activeSchedulesMenu.middleware())
  }

  private trainingScheduleHandler = async (ctx: BotContext) => {
    this.groupSelectMenu.initMenu(ctx, { userId: UserHelper.getUser(ctx).id })
  }

  private activeSchedulesHandler = async (ctx: BotContext) => {
    this.activeSchedulesMenu.initMenu(ctx)
  }

  private handleGroupSelect = async (ctx: BotContext, groupId: string) => {
    ctx.answerCbQuery()
    const { id, client, role } = UserHelper.getUser(ctx)
    const group = await this.groupService.getGroupById(groupId)
    return this.trainingSelectMenu.initMenu(ctx, { group, clientId: client?.id, userId: id, role }, { shouldEdit: true })
  }

  private handleTrainingSelect = async (ctx: BotContext, trainingId: string) => {
    const { id, client, role } = UserHelper.getUser(ctx)
    const isUserClient = UserHelper.isClientRole(role)

    const currentActivePass = client?.pass?.find((p) => p.status === PassStatusEnum.ACTIVE)

    if (isUserClient) {
      if (!client || !currentActivePass) {
        return ctx.answerCbQuery(
          `Ой-ой! 🤸‍♀️ Поки що не бачу твого активного абонементу. Не сумуй, мерщій оновлюй його, щоб не пропустити улюблені заняття! 😉🔥`,
          { show_alert: true },
        )
      }
      const response = await this.trainingSignupService.signUpForTrainingAsClientViaTelegram({
        trainingId,
        userProfileId: id,
        passId: currentActivePass.id,
      })

      if (response.status === API.RESPONSE.ERROR_STRING) {
        return ctx.answerCbQuery(response.message, { show_alert: true })
      }

      console.log(response, 'response from signUpForTrainingAsClientViaTelegram')

      switch (response.availableSlots) {
        case 1:
          return ctx.answerCbQuery(
            'Вітаю, запис успішний!🤗\n\nУ тебе залишився 1 доступний запис на тренування в межах даного абонемента🛎',
            { show_alert: true },
          )
        default:
          return ctx.answerCbQuery(response.message, { show_alert: true })
      }
    } else {
      ctx.answerCbQuery()
    }
  }
}
