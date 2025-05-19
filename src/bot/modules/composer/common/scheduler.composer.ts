import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { PATTERNS_CLIENT, PATTERNS_COMMON } from '@app/bot/static/patterns'
import { API, CALLBACK_PREFIX } from '@app/libs'
import { GroupSelectMenu, TrainingSelectMenu } from '@app/bot/modules/inline-menu'
import { UserHelper } from '@app/bot/helpers'
import { TrainingSignupService } from '@app/domain/training-signup'
import { GroupAgeRestrictionService } from '@app/domain/group-age-restriction'
import { GroupService } from '@app/domain/group'
import { MessageHelper } from '@app/bot/helpers/message.helper'

@Injectable()
export class SchedulerComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    private readonly groupSelectMenu: GroupSelectMenu,
    private readonly trainingSelectMenu: TrainingSelectMenu,
    private readonly trainingSignupService: TrainingSignupService,
    private readonly groupService: GroupService
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
    this.groupSelectMenu.configure({
      callbackPrefix: CALLBACK_PREFIX.CLIENT_GROUP_SELECT,
      promptMessage: 'Виберіть групу:',
      onItemSelect: this.handleGroupSelect,
    })

    this.trainingSelectMenu.configure({
      callbackPrefix: CALLBACK_PREFIX.CLEINT_TRAINING_SELECT,
      promptMessage: 'Виберіть тренування:',
      onItemSelect: this.handleTrainingSelect,
    })
    this.composer.use(this.groupSelectMenu.middleware())
    this.composer.use(this.trainingSelectMenu.middleware())
  }

  private trainingScheduleHandler = async (ctx: BotContext) => {
    this.groupSelectMenu.initMenu(ctx)
  }

  private activeSchedulesHandler = async (ctx: BotContext) => {
    await ctx.reply('Active schedules handler works')
  }

  private handleGroupSelect = async (ctx: BotContext, groupId: string) => {
    ctx.answerCbQuery()
    const { id, client, role } = UserHelper.getUser(ctx)
    const group = await this.groupService.getGroupById(groupId)
    await ctx.reply(`Ви обрали групу: ${group.name}`)
    if (group.groupAgeRestrictions) {
      await ctx.reply(MessageHelper.getAgeRestrictionMessage(group.groupAgeRestrictions.minAge, group.groupAgeRestrictions.maxAge))
    }
    return this.trainingSelectMenu.initMenu(ctx, { groupId, clientId: client?.id, userId: id, role })
  }

  private handleTrainingSelect = async (ctx: BotContext, trainingId: string) => {
    const { id, client, role } = UserHelper.getUser(ctx)
    const isUserClient = UserHelper.isClientRole(role)

    if (isUserClient) {
      if (!client || !client?.pass) {
        return ctx.answerCbQuery(`Ой-ой! 🤸‍♀️ Поки що не бачу твого активного абонементу. Не сумуй, мерщій оновлюй його, щоб не пропустити улюблені заняття! 😉🔥`, { show_alert: true })
      }
      const response = await this.trainingSignupService.signUpForTrainingAsClientViaTelegram({
        trainingId,
        userProfileId: id,
        passId: client.pass.id,
      })

      if (response.status === API.RESPONSE.ERROR_STRING) {
        return ctx.answerCbQuery(response.message, { show_alert: true })
      }

      switch (response.availableSlots) {
        case 1:
          return ctx.answerCbQuery(
            'Вітаю, запис успішний!🤗\n\nУ Вас залишився 1 доступний запис на тренування в межах даного абонемента🛎',
          )
        default:
          return ctx.answerCbQuery(response.message)
      }
    } else {
      ctx.answerCbQuery()
    }
  }
}
