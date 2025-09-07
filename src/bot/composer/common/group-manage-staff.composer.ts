import { Composer } from 'telegraf'
import { Inject, Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import {
  ClientSelectPaginatedMenu,
  GroupSelectPaginatedMenu,
  TrainingSelectStaffPaginatedMenu,
  CLIENT_SIGNOUT_MENU,
} from '@app/bot/menus'
import { CALLBACK_PREFIX, TPaginatedMenuRenderOptions } from '@app/bot/libs'
import { AdminKeyboards, TrainerKeyboards } from '@app/bot/keyboard/storage'
import { GroupService } from '@app/domain/group'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { RegexHelper, UserHelper } from '@app/bot/helpers'
import { TrainingService } from '@app/domain/training'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { TrainingSignupService } from '@app/domain/training-signup'
import { API, TrainingSignupStatusEnum } from '@app/libs'

@Injectable()
export class GroupManageStaffComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly groupSelectPaginatedMenu: GroupSelectPaginatedMenu,
    private readonly trainingSelectStaffPaginatedMenu: TrainingSelectStaffPaginatedMenu,
    @Inject(CLIENT_SIGNOUT_MENU) private readonly clientSelectSignOutPaginatedMenu: ClientSelectPaginatedMenu,
    private readonly groupService: GroupService,
    private readonly trainingService: TrainingService,
    private readonly trainingSignupService: TrainingSignupService,
  ) {
    this.composer = new Composer<BotContext>()

    this.useMenusMiddleware()

    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  private useMenusMiddleware() {
    this.composer.use(
      this.groupSelectPaginatedMenu.middleware({
        callbackPrefix: CALLBACK_PREFIX.STAFF.GROUP.SELECT,
        promptMessage: (ctx: BotContext) => this.getStaffMemberMessages(ctx, 'prompt'),
        noOptionsMessage: (ctx: BotContext) => this.getStaffMemberMessages(ctx, 'noOptions'),
        onItemSelect: this.renderGroupManageMenu,
      }),
    )
    this.composer.use(
      this.trainingSelectStaffPaginatedMenu.middleware({
        callbackPrefix: CALLBACK_PREFIX.STAFF.GROUP.TRAININGS_SELECT,
        noOptionsMessage: '📅 В цій групі немає доступних тренувань',
        onItemSelect: this.renderTrainingManageMenu,
      }),
    )
    this.composer.use(
      this.clientSelectSignOutPaginatedMenu.middleware({
        callbackPrefix: CALLBACK_PREFIX.STAFF.TRAINING.CLIENT_SIGNOUT_SELECT,
        promptMessage: '👤 Оберіть клієнта для скасування запису:',
        noOptionsMessage: '📋 На це тренування немає активних записів',
        onItemSelect: this.handleClientSignOutPaginatedSelect,
      }),
    )
  }

  initComposerHandlers() {
    this.composer.hears(BUTTON_PATTERNS.GROUPS, async (ctx: BotContext) => {
      return this.renderGroupSelectMenu(ctx, { shouldEdit: false })
    })

    this.composer.hears(BUTTON_PATTERNS.UPCOMING_TRAININGS, async (ctx: BotContext) => {
      return this.renderUpcomingTrainingsMenu(ctx)
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.GROUP.TRAININGS), async (ctx: BotContext) => {
      return this.renderTrainingSelectMenu(ctx, { shouldEdit: true })
    })

    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.GROUP.BACK_TO_SELECT),
      async (ctx: BotContext) => {
        const [_, staffMemberId] = RegexHelper.getMatchGroupValue(ctx)

        let backButtonCallbackData: string | null = null

        if (!!staffMemberId) {
          backButtonCallbackData = RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.PAYOUT.BACK_TO_STAFF_MANAGE,
            staffMemberId,
            'true',
          )
        }

        return this.renderGroupSelectMenu(ctx, { backButtonCallbackData, shouldEdit: true }, staffMemberId || undefined)
      },
    )

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.MANAGE.GROUPS_LIST), async (ctx: BotContext) => {
      const [userId, isAdmin] = RegexHelper.getMatchGroupValue(ctx)
      if (!userId) {
        ctx.answerCbQuery('❗️ Помилка при виборі тренера. Спробуйте ще раз.')
        ctx.deleteMessage()
        return
      }

      const backButtonCallbackData = RegexHelper.createButtonActionCallbackData(
        CALLBACK_PREFIX.STAFF.PAYOUT.BACK_TO_STAFF_MANAGE,
        userId,
        isAdmin,
      )

      return this.renderGroupSelectMenu(ctx, { backButtonCallbackData, shouldEdit: true }, userId)
    })

    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.GROUP.BACK_TO_TRAININGS_SELECT),
      async (ctx: BotContext) => {
        return this.renderTrainingSelectMenu(ctx, { shouldEdit: true })
      },
    )

    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.GROUP.BACK_TO_SELECTED_GROUP),
      async (ctx: BotContext) => {
        const [groupId, staffUserId] = RegexHelper.getMatchGroupValue(ctx)

        if (!groupId) {
          ctx.answerCbQuery('Не вдалося повернутися до групи.', { show_alert: true })
          ctx.deleteMessage()
          return
        }

        return this.renderGroupManageMenu(ctx, groupId, { staffUserId })
      },
    )

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.CANCEL), async (ctx: BotContext) => {
      return this.handleTrainingAction(ctx, async (trainingId, backButtonCallbackData, staffUserId) => {
        const { training, signups } = await this.trainingService.cancelTrainingById(+trainingId)

        await Promise.all(
          signups.map((signup) => {
            return ctx.telegram.sendMessage(
              String(signup.userProfile?.telegramId),
              MessageHelper.constructTrainingCancelMessage(
                { date: training.date, groupName: signup?.group?.name },
                this.dateTimeProvider,
              ),
              {
                parse_mode: 'HTML',
              },
            )
          }),
        )

        return this.renderTrainingManageMenu(ctx, trainingId, { fromUpcomingTrainingsMenu: !!backButtonCallbackData, staffUserId })
      })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.ACTIVATE), async (ctx: BotContext) => {
      return this.handleTrainingAction(ctx, async (trainingId, backButtonCallbackData, staffUserId) => {
        const { training, signups } = await this.trainingService.activateTrainingById(+trainingId)
        await Promise.all(
          signups.map((signup) => {
            return ctx.telegram.sendMessage(
              String(signup.userProfile?.telegramId),
              MessageHelper.constructTrainingActivateMessage(
                { date: training.date, groupName: signup?.group?.name },
                this.dateTimeProvider,
              ),
              {
                parse_mode: 'HTML',
              },
            )
          }),
        )
        return this.renderTrainingManageMenu(ctx, trainingId, { fromUpcomingTrainingsMenu: !!backButtonCallbackData, staffUserId })
      })
    })

    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.BACK_TO_MANAGE),
      async (ctx: BotContext) => {
        return this.handleTrainingAction(ctx, (trainingId, backButtonCallbackData, staffUserId) => {
          return this.renderTrainingManageMenu(ctx, trainingId, {
            fromUpcomingTrainingsMenu: !!backButtonCallbackData,
            staffUserId,
          })
        })
      },
    )

    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.SIGNUPS_ACTIVE),
      async (ctx: BotContext) => {
        return this.handleTrainingAction(ctx, async (trainingId, backButtonCallbackData, staffUserId) => {
          ctx.answerCbQuery()
          const activeSignUps = await this.trainingSignupService.getTrainingActiveSignups(+trainingId)
          return ctx.editMessageText(MessageHelper.constructSignupListMessage(activeSignUps, TrainingSignupStatusEnum.ACTIVE), {
            parse_mode: 'HTML',
            ...AdminKeyboards.backForTrainingManage(trainingId, backButtonCallbackData, staffUserId),
          })
        })
      },
    )

    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.SIGNUPS_CANCELED),
      async (ctx: BotContext) => {
        return this.handleTrainingAction(ctx, async (trainingId, backButtonCallbackData, staffUserId) => {
          ctx.answerCbQuery()
          const canceledSignups = await this.trainingSignupService.getTrainingCancelledSignups(+trainingId)
          return ctx.editMessageText(MessageHelper.constructSignupListMessage(canceledSignups, TrainingSignupStatusEnum.CANCELED), {
            parse_mode: 'HTML',
            ...AdminKeyboards.backForTrainingManage(trainingId, backButtonCallbackData, staffUserId),
          })
        })
      },
    )

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.SIGN_IN), async (ctx: BotContext) => {
      return this.handleTrainingAction(ctx, async (trainingId, backButtonCallbackData, staffUserId) => {
        ctx.answerCbQuery()
        ctx.reply('В процеці розробки...)')
        // return ctx.scene.enter(SCENES.SIGN_IN_CLIENT, { trainingId })
        // console.log('Sign in action triggered for trainingId:', trainingId)
      })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.SIGN_OUT), async (ctx: BotContext) => {
      return this.handleTrainingAction(ctx, async (trainingId, backButtonCallbackData, staffUserId) => {
        const activeSignUps = await this.trainingSignupService.getTrainingActiveSignups(+trainingId)
        const data = activeSignUps.map((signup) => ({
          name: `${signup.userProfile?.firstName} ${signup.userProfile?.lastName}`,
          id: signup.id,
        }))
        return this.clientSelectSignOutPaginatedMenu.initMenu(
          ctx,
          { data },
          { context: { fromUpcomingTrainingsMenu: !!backButtonCallbackData, staffUserId } },
        )
      })
    })

    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.BACK_TO_CLOSEST_TRAINING_LIST),
      async (ctx: BotContext) => {
        return this.renderUpcomingTrainingsMenu(ctx, { shouldEdit: true, withExitButton: true })
      },
    )
  }

  private renderUpcomingTrainingsMenu = async (
    ctx: BotContext,
    options: TPaginatedMenuRenderOptions = { shouldEdit: false, withExitButton: true },
  ) => {
    const { id } = UserHelper.getUser(ctx)
    const upcomingTrainings = await this.trainingService.getUpcomingTrainingsForStaff(id)
    return this.trainingSelectStaffPaginatedMenu.initMenu(
      ctx,
      { trainings: upcomingTrainings },
      { context: { fromUpcomingTrainingsMenu: true }, ...options },
    )
  }

  private renderGroupSelectMenu = async (
    ctx: BotContext,
    options: TPaginatedMenuRenderOptions = { shouldEdit: true, backButtonCallbackData: null },
    staffUserId?: string,
  ) => {
    const { id, role } = UserHelper.getUser(ctx)
    return this.groupSelectPaginatedMenu.initMenu(
      ctx,
      { userId: id, role, staffUserId },
      {
        shouldEdit: options.shouldEdit,
        backButtonCallbackData: options.backButtonCallbackData,
        withExitButton: !options.backButtonCallbackData,
        context: { staffUserId: staffUserId },
      },
    )
  }

  private renderTrainingSelectMenu = async (ctx: BotContext, { shouldEdit }: TPaginatedMenuRenderOptions) => {
    const [groupId, staffUserId] = RegexHelper.getMatchGroupValue(ctx)
    if (!groupId) {
      ctx.answerCbQuery('❗️ Не вдалося завантажити тренування. Спробуйте ще раз.', { show_alert: true })
      ctx.deleteMessage()
      return
    }
    const group = await this.groupService.getGroupById(+groupId)
    const backButtonCallbackData = RegexHelper.createButtonActionCallbackData(
      CALLBACK_PREFIX.STAFF.GROUP.BACK_TO_SELECTED_GROUP,
      groupId,
      staffUserId,
    )
    return this.trainingSelectStaffPaginatedMenu.initMenu(
      ctx,
      { group },
      { shouldEdit, backButtonCallbackData, context: { staffUserId: staffUserId } },
    )
  }

  private renderTrainingManageMenu = async (ctx: BotContext, trainingId: string, context: Record<string, any> = {}) => {
    await ctx.answerCbQuery()
    const training = await this.trainingService.getTrainingById(+trainingId)
    const group = await this.groupService.getGroupById(training.groupId)

    const { fromUpcomingTrainingsMenu, staffUserId } = context

    const isAdmin = UserHelper.isAdminRole(ctx)

    const backButtonCallbackData = fromUpcomingTrainingsMenu ? CALLBACK_PREFIX.STAFF.TRAINING.BACK_TO_CLOSEST_TRAINING_LIST : null

    return ctx.editMessageText(MessageHelper.constructTrainingSelectMessage(training, group, this.dateTimeProvider), {
      parse_mode: 'HTML',
      ...(isAdmin
        ? AdminKeyboards.trainingManageMenu(training, backButtonCallbackData, staffUserId)
        : TrainerKeyboards.trainingManageMenu(training, backButtonCallbackData)),
    })
  }

  private renderGroupManageMenu = async (ctx: BotContext, groupId: string, context: Record<string, any> = {}) => {
    ctx.answerCbQuery()
    const group = await this.groupService.getGroupById(+groupId)
    return ctx.editMessageText(MessageHelper.constructGroupSelectMessage(group), {
      parse_mode: 'HTML',
      ...AdminKeyboards.groupManageMenu(+groupId, context.staffUserId),
    })
  }

  private handleClientSignOutPaginatedSelect = async (ctx: BotContext, signupId: string) => {
    const response = await this.trainingSignupService.signOutFromTrainingAsAdminViaTelegram(signupId)

    if (response.status === API.RESPONSE.ERROR_STRING) {
      return ctx.answerCbQuery(response.message, { show_alert: true })
    }

    if (response.status === API.RESPONSE.SUCCESS_STRING) {
      const { userProfile, training } = response.data || {}

      if (!training) return ctx.reply('Невдалось знайти тренування')

      const activeSignUps = await this.trainingSignupService.getTrainingActiveSignups(training!.id)

      if (userProfile?.telegramId) {
        const group = await this.groupService.getGroupById(training.groupId)

        ctx.telegram.sendMessage(
          String(userProfile.telegramId),
          MessageHelper.constructTrainingSignoutByAdminMessage(
            { date: training.date, groupName: group.name },
            this.dateTimeProvider,
          ),
          {
            parse_mode: 'HTML',
          },
        )
      }

      if (activeSignUps.length === 0) {
        return ctx.editMessageText('✅ На це тренування більше немає активних записів.')
      }

      return this.clientSelectSignOutPaginatedMenu.initMenu(ctx, { data: activeSignUps }, { shouldEdit: true })
    }
  }

  private getStaffMemberMessages(ctx: BotContext, messageType: 'noOptions' | 'prompt' | 'trainings') {
    const role = UserHelper.getUserRole(ctx)
    return MessageHelper.getStaffMemberMessages(role, messageType)
  }

  private async handleTrainingAction(
    ctx: BotContext,
    action: (trainingId: string, backButtonCallbackData?: string | null, staffUserId?: string | null) => Promise<any>,
  ) {
    const [trainingId, backButtonCallbackData] = RegexHelper.getMatchGroupValue(ctx)

    const staffUserId = RegexHelper.isValidUuid(backButtonCallbackData) ? backButtonCallbackData : undefined

    if (!trainingId) {
      ctx.answerCbQuery('⚠️ Не вдалося повернутися до тренування.', { show_alert: true })
      ctx.deleteMessage()
      return
    }

    return action(trainingId, staffUserId ? null : backButtonCallbackData, staffUserId)
  }
}
