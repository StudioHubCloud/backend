import { Composer } from 'telegraf'
import { Inject, Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import {
  ClientSelectPaginatedMenu,
  GroupSelectPaginatedMenu,
  TrainingSelectStaffPaginatedMenu,
  StaffSelectPaginatedMenu,
  PassSelectPaginatedMenu,
  CLIENT_SIGNOUT_MENU,
  CLIENT_SIGNIN_MENU,
} from '@app/bot/menus'
import { CALLBACK_PREFIX, COMMON, SCENES, TPaginatedMenuRenderOptions } from '@app/bot/libs'
import { PinoLogger } from 'nestjs-pino'
import { AdminKeyboards, ScheduleKeyboards, TrainerKeyboards } from '@app/bot/keyboard/storage'
import { GroupService } from '@app/domain/group'
import { UserProfileService } from '@app/domain/user-profile'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { BotHelper, RegexHelper, UserHelper } from '@app/bot/helpers'
import { TrainingService } from '@app/domain/training'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { TrainingSignupService } from '@app/domain/training-signup'
import { API, AuditLogActions, AuditLogTrigger, PassStatusEnum, TrainingSignupStatusEnum, TrainingSignupTypeEnum } from '@app/libs'
import { AuditLogHelper } from '@app/bot/helpers/audit-log.helper'

const ADMIN_ONLY_MESSAGE = '⛔️ Доступно лише адміністратору'
const NOT_YOUR_GROUP_MESSAGE = '👀 Це не ваша група'

@Injectable()
export class GroupManageStaffComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    private readonly logger: PinoLogger,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly groupSelectPaginatedMenu: GroupSelectPaginatedMenu,
    private readonly trainingSelectStaffPaginatedMenu: TrainingSelectStaffPaginatedMenu,
    private readonly staffSelectPaginatedMenu: StaffSelectPaginatedMenu,
    @Inject(CLIENT_SIGNOUT_MENU) private readonly clientSelectSignOutPaginatedMenu: ClientSelectPaginatedMenu,
    @Inject(CLIENT_SIGNIN_MENU) private readonly clientSelectSignInPaginatedMenu: ClientSelectPaginatedMenu,
    private readonly passSelectPaginatedMenu: PassSelectPaginatedMenu,
    private readonly groupService: GroupService,
    private readonly trainingService: TrainingService,
    private readonly trainingSignupService: TrainingSignupService,
    private readonly userProfileService: UserProfileService,
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
    this.composer.use(
      this.clientSelectSignInPaginatedMenu.middleware({
        callbackPrefix: CALLBACK_PREFIX.STAFF.TRAINING.CLIENT_SIGNIN_SELECT,
        promptMessage: '👤 Оберіть клієнта для запису на тренування:',
        noOptionsMessage: '👤 Немає доступних клієнтів для запису',
        onItemSelect: this.handleClientSignInPaginatedSelect,
      }),
    )
    this.composer.use(
      this.passSelectPaginatedMenu.middleware({
        callbackPrefix: CALLBACK_PREFIX.STAFF.TRAINING.SIGN_IN_PASS_SELECT,
        noOptionsMessage: '🥲 У клієнта немає абонементів для запису',
        onItemSelect: this.handleSignInPassSelect,
      }),
    )

    this.composer.use(
      this.staffSelectPaginatedMenu.middleware({
        callbackPrefix: CALLBACK_PREFIX.STAFF.TRAINING.ASSIGN_SUBSTITUTE_SELECT,
        promptMessage: '👤 Оберіть тренера який проведе тренування:',
        noOptionsMessage: '📋 Немає доступних тренерів для заміни',
        onItemSelect: this.handleStaffSelectPaginatedSelect,
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
        const [_, slotValue] = RegexHelper.getMatchGroupValue(ctx)
        // Another trainer's group list is for admins only ("Персонал" → trainer → groups)
        const staffMemberId = UserHelper.isAdminRole(ctx) ? slotValue : null

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
      if (!UserHelper.isAdminRole(ctx)) {
        return BotHelper.safeAnswerCbQuery(ctx, ADMIN_ONLY_MESSAGE, { show_alert: true })
      }
      if (!userId) {
        BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка при виборі тренера. Спробуйте ще раз.')
        BotHelper.safeDeleteMessage(ctx)
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
          BotHelper.safeAnswerCbQuery(ctx, 'Не вдалося повернутися до групи.', { show_alert: true })
          BotHelper.safeDeleteMessage(ctx)
          return
        }

        return this.renderGroupManageMenu(ctx, groupId, { staffUserId })
      },
    )

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.CANCEL), async (ctx: BotContext) => {
      return this.handleAdminTrainingAction(ctx, async (trainingId, backButtonCallbackData, staffUserId) => {
        const { training, signups } = await this.trainingService.cancelTrainingById(+trainingId)

        await Promise.all(
          signups
            .filter((s) => s.type !== TrainingSignupTypeEnum.SPECIAL)
            .map((signup) => {
              return BotHelper.safeSendMessage(
                ctx.telegram,
                String(signup.userProfile?.telegramId),
                MessageHelper.constructTrainingCancelMessage(
                  { date: training.date, groupName: signup?.group?.name },
                  this.dateTimeProvider,
                ),
              )
            }),
        )

        return this.renderTrainingManageMenu(ctx, trainingId, { fromUpcomingTrainingsMenu: !!backButtonCallbackData, staffUserId })
      })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.ACTIVATE), async (ctx: BotContext) => {
      return this.handleAdminTrainingAction(ctx, async (trainingId, backButtonCallbackData, staffUserId) => {
        const { training, signups } = await this.trainingService.activateTrainingById(+trainingId)
        await Promise.all(
          signups
            .filter((s) => s.type !== TrainingSignupTypeEnum.SPECIAL)
            .map((signup) => {
              return BotHelper.safeSendMessage(
                ctx.telegram,
                String(signup.userProfile?.telegramId),
                MessageHelper.constructTrainingActivateMessage(
                  { date: training.date, groupName: signup?.group?.name },
                  this.dateTimeProvider,
                ),
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
          BotHelper.safeAnswerCbQuery(ctx)

          const activeSignUps = await this.trainingSignupService.getTrainingActiveSignups(+trainingId)
          return BotHelper.safeEditMessageText(
            ctx,
            MessageHelper.constructSignupListMessage(activeSignUps, TrainingSignupStatusEnum.ACTIVE),
            AdminKeyboards.backForTrainingManage(trainingId, backButtonCallbackData, staffUserId),
          )
        })
      },
    )

    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.SIGNUPS_CANCELED),
      async (ctx: BotContext) => {
        return this.handleTrainingAction(ctx, async (trainingId, backButtonCallbackData, staffUserId) => {
          BotHelper.safeAnswerCbQuery(ctx)
          const canceledSignups = await this.trainingSignupService.getTrainingCancelledSignups(+trainingId)
          return BotHelper.safeEditMessageText(
            ctx,
            MessageHelper.constructSignupListMessage(canceledSignups, TrainingSignupStatusEnum.CANCELED),
            AdminKeyboards.backForTrainingManage(trainingId, backButtonCallbackData, staffUserId),
          )
        })
      },
    )

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.SIGN_IN), async (ctx: BotContext) => {
      return this.handleAdminTrainingAction(ctx, async (trainingId, backButtonCallbackData, staffUserId) => {
        const activeClients = await this.userProfileService.getActiveClientsForSignIn(+trainingId)
        const data = activeClients.map((client) => {
          const activePass = client.client?.pass.find((p) => p.status === PassStatusEnum.ACTIVE)
          return {
            name: `${UserHelper.getDisplayName(client)}`,
            status: client.status,
            id: client.id,
            availableSlots: activePass?.availableSlots ?? null,
            hasActivePass: !!activePass,
          }
        })

        const backBtnCbData = RegexHelper.createButtonActionCallbackData(
          CALLBACK_PREFIX.STAFF.TRAINING.BACK_TO_MANAGE,
          trainingId,
          staffUserId ?? backButtonCallbackData,
        )

        return this.clientSelectSignInPaginatedMenu.initMenu(
          ctx,
          { data },
          {
            backButtonCallbackData: backBtnCbData,
            shouldEdit: true,
            context: { fromUpcomingTrainingsMenu: !!backButtonCallbackData, staffUserId, trainingId, backBtnCbData },
          },
        )
      })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.SIGN_OUT), async (ctx: BotContext) => {
      return this.handleAdminTrainingAction(ctx, async (trainingId, backButtonCallbackData, staffUserId) => {
        const activeSignUps = await this.trainingSignupService.getTrainingActiveSignups(+trainingId)
        const data = activeSignUps.map((signup) => ({
          name: `${UserHelper.getSignupDisplayName(signup)}`,
          status: signup.userProfile?.status,
          id: signup.id,
        }))

        const backBtnCbData = RegexHelper.createButtonActionCallbackData(
          CALLBACK_PREFIX.STAFF.TRAINING.BACK_TO_MANAGE,
          trainingId,
          staffUserId ?? backButtonCallbackData,
        )

        return this.clientSelectSignOutPaginatedMenu.initMenu(
          ctx,
          { data },
          {
            backButtonCallbackData: backBtnCbData,
            shouldEdit: true,
            context: { fromUpcomingTrainingsMenu: !!backButtonCallbackData, staffUserId },
          },
        )
      })
    })

    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.CUSTOM_SIGN_IN),
      async (ctx: BotContext) => {
        return this.handleAdminTrainingAction(ctx, async (trainingId, backButtonCallbackData, staffUserId) => {
          const context = { fromUpcomingTrainingsMenu: !!backButtonCallbackData, staffUserId, trainingId }
          await ctx.deleteMessage().catch(() => {})
          return ctx.scene.enter(SCENES.SPECIAL_SCHEDULE, context)
        })
      },
    )

    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.ASSIGN_SUBSTITUTE_LIST),
      async (ctx: BotContext) => {
        return this.handleAdminTrainingAction(ctx, async (trainingId, backButtonCallbackData, staffUserId) => {
          const backButtonCbData = RegexHelper.createButtonActionCallbackData(
            CALLBACK_PREFIX.STAFF.TRAINING.BACK_TO_MANAGE,
            trainingId,
            staffUserId ?? backButtonCallbackData,
          )

          const training = await this.trainingService.getTrainingById(+trainingId)
          if (!training) {
            BotHelper.safeAnswerCbQuery(ctx, '❗️ Не вдалося завантажити тренування. Спробуйте ще раз.', { show_alert: true })
            BotHelper.safeDeleteMessage(ctx)
            return
          }
          const group = await this.groupService.getGroupById(training.groupId)

          const currentTrainerId = group.staffMemberId

          return this.staffSelectPaginatedMenu.initMenu(
            ctx,
            { targetTrainingId: trainingId },
            {
              context: {
                fromUpcomingTrainingsMenu: !!backButtonCallbackData,
                staffUserId,
                trainingId,
                excludeStaffMemberId: currentTrainerId,
              },
              backButtonCallbackData: backButtonCbData,
              shouldEdit: true,
            },
          )
        })
      },
    )
    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.DEASSIGN_SUBSTITUTE_LIST),
      async (ctx: BotContext) => {
        return this.handleAdminTrainingAction(ctx, async (trainingId, backButtonCallbackData, staffUserId) => {
          await this.trainingService.deassignSubstituteTrainer(+trainingId)
          await this.notifyClientsAboutSubstituteTrainer(ctx, trainingId, 'deassign')
          BotHelper.safeAnswerCbQuery(ctx, '✅ Заміна тренера скасована.')
          return this.renderTrainingManageMenu(ctx, trainingId, {
            fromUpcomingTrainingsMenu: !!backButtonCallbackData,
            staffUserId,
          })
        })
      },
    )

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
    const isMaintainer = UserHelper.isMaintainerRole(ctx)

    if (isMaintainer) {
      return ctx.reply('⚠️  Для цієї ролі функціонал недоступний')
    }

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
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Не вдалося завантажити тренування. Спробуйте ще раз.', { show_alert: true })
      BotHelper.safeDeleteMessage(ctx)
      return
    }
    const group = await this.groupService.getGroupById(+groupId)

    if (!(await this.canViewGroup(ctx, group))) {
      return BotHelper.safeAnswerCbQuery(ctx, NOT_YOUR_GROUP_MESSAGE, { show_alert: true })
    }

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
    const training = await this.trainingService.getTrainingById(+trainingId)
    const group = await this.groupService.getGroupById(training.groupId)

    if (!(await this.canViewGroup(ctx, group, training.trainerId))) {
      return BotHelper.safeAnswerCbQuery(ctx, NOT_YOUR_GROUP_MESSAGE, { show_alert: true })
    }

    await BotHelper.safeAnswerCbQuery(ctx)

    const hasSubstituteTrainer = !!training.trainer

    const { fromUpcomingTrainingsMenu, staffUserId } = context

    const isAdmin = UserHelper.isAdminRole(ctx)

    const backButtonCallbackData = fromUpcomingTrainingsMenu ? CALLBACK_PREFIX.STAFF.TRAINING.BACK_TO_CLOSEST_TRAINING_LIST : null

    return BotHelper.safeEditMessageText(
      ctx,
      MessageHelper.constructTrainingSelectMessage(training, group, this.dateTimeProvider),
      {
        // Opened from the studio schedule (origin in the staffUserId slot): "Назад" leads back to that day
        ...(isAdmin
          ? AdminKeyboards.trainingManageMenu(training, backButtonCallbackData, staffUserId, hasSubstituteTrainer, ScheduleKeyboards.backButtonForOrigin(staffUserId))
          : TrainerKeyboards.trainingManageMenu(training, backButtonCallbackData, staffUserId, ScheduleKeyboards.backButtonForOrigin(staffUserId))),
      },
    )
  }

  private renderGroupManageMenu = async (ctx: BotContext, groupId: string, context: Record<string, any> = {}) => {
    const group = await this.groupService.getGroupById(+groupId)

    if (!(await this.canViewGroup(ctx, group))) {
      return BotHelper.safeAnswerCbQuery(ctx, NOT_YOUR_GROUP_MESSAGE, { show_alert: true })
    }

    BotHelper.safeAnswerCbQuery(ctx)

    return BotHelper.safeEditMessageText(
      ctx,
      MessageHelper.constructGroupSelectMessage(group),
      AdminKeyboards.groupManageMenu(+groupId, context.staffUserId, ScheduleKeyboards.backButtonForOrigin(context.staffUserId)),
    )
  }

  private handleClientSignOutPaginatedSelect = async (ctx: BotContext, signupId: string, context: Record<string, any> = {}) => {
    if (!UserHelper.isAdminRole(ctx)) {
      return BotHelper.safeAnswerCbQuery(ctx, ADMIN_ONLY_MESSAGE, { show_alert: true })
    }

    const response = await this.trainingSignupService.signOutFromTrainingAsAdminViaTelegram(signupId)

    if (response.status === API.RESPONSE.ERROR_STRING) {
      return BotHelper.safeAnswerCbQuery(ctx, response.message, { show_alert: true })
    }

    if (response.status === API.RESPONSE.SUCCESS_STRING) {
      const { userProfile, training } = response.data || {}

      if (!training) {
        BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка. Спробуйте ще раз.', { show_alert: true })
        BotHelper.safeDeleteMessage(ctx)
        return
      }

      const activeSignUps = await this.trainingSignupService.getTrainingActiveSignups(training!.id)

      if (userProfile?.telegramId) {
        const group = await this.groupService.getGroupById(training.groupId)

        const now = new Date()
        const trainingDate = new Date(training.date)

        if (now < trainingDate) {
          BotHelper.safeSendMessage(
            ctx.telegram,
            String(userProfile.telegramId),
            MessageHelper.constructTrainingSignoutByAdminMessage(
              { date: training.date, groupName: group.name },
              this.dateTimeProvider,
            ),
          )
        }
      }

      if (activeSignUps.length === 0) {
        await BotHelper.safeAnswerCbQuery(ctx, '✅ На це тренування більше немає активних записів.', { show_alert: true })
        return this.renderTrainingManageMenu(ctx, String(training.id), context)
      }

      BotHelper.safeAnswerCbQuery(ctx, '✅ Клієнта успішно відписано від тренування.', { show_alert: true })
      const data = activeSignUps.map((signup) => ({
        name: `${UserHelper.getSignupDisplayName(signup)}`,
        id: signup.id,
      }))

      const backBtnCbData = RegexHelper.createButtonActionCallbackData(
        CALLBACK_PREFIX.STAFF.TRAINING.BACK_TO_MANAGE,
        training.id,
        context.staffUserId,
      )

      return this.clientSelectSignOutPaginatedMenu.initMenu(
        ctx,
        { data },
        { backButtonCallbackData: backBtnCbData, shouldEdit: true, context },
      )
    }
  }

  private handleClientSignInPaginatedSelect = async (ctx: BotContext, userId: string, context: Record<string, any> = {}) => {
    if (!UserHelper.isAdminRole(ctx)) {
      return BotHelper.safeAnswerCbQuery(ctx, ADMIN_ONLY_MESSAGE, { show_alert: true })
    }

    const { trainingId } = context

    if (!trainingId) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка. Спробуйте ще раз.', { show_alert: true })
      BotHelper.safeDeleteMessage(ctx)
      return
    }

    return this.signInClient(ctx, userId, trainingId, context)
  }

  /** Admin picked the pass for a client without a pass covering the training's group (warning shown before). */
  private handleSignInPassSelect = async (ctx: BotContext, passId: string, context: Record<string, any> = {}) => {
    if (!UserHelper.isAdminRole(ctx)) {
      return BotHelper.safeAnswerCbQuery(ctx, ADMIN_ONLY_MESSAGE, { show_alert: true })
    }

    const { trainingId, userId } = context

    if (!trainingId || !userId) {
      await BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка. Спробуйте ще раз.', { show_alert: true })
      return BotHelper.safeDeleteMessage(ctx)
    }

    return this.signInClient(ctx, userId, trainingId, context, passId)
  }

  private signInClient = async (
    ctx: BotContext,
    userId: string,
    trainingId: string,
    context: Record<string, any>,
    passId?: string,
  ) => {
    const response = await this.trainingSignupService.signInToTrainingAsAdminViaTelegram(userId, +trainingId, passId)

    if (response.passChoice) {
      return this.passSelectPaginatedMenu.initMenu(
        ctx,
        { prompt: response.message, data: response.passChoice },
        { shouldEdit: true, backButtonCallbackData: context.backBtnCbData, context: { ...context, userId } },
      )
    }

    if (response.status === API.RESPONSE.ERROR_STRING) {
      return BotHelper.safeAnswerCbQuery(ctx, response.message, { show_alert: true })
    }

    await BotHelper.safeAnswerCbQuery(ctx, response.message, { show_alert: true })
    AuditLogHelper.startAction(ctx, AuditLogActions.TRAINING_SIGNUP_CREATE, AuditLogTrigger.ADMIN_ACTION, response.data?.logOperations)

    const { userProfile, groupId } = response.data || {}

    if (userProfile?.telegramId && groupId) {
      const [group, training] = await Promise.all([
        this.groupService.getGroupById(groupId),
        this.trainingService.getTrainingById(+trainingId),
      ])

      const now = new Date()
      const trainingDate = new Date(training.date)

      if (now < trainingDate) {
        BotHelper.safeSendMessage(
          ctx.telegram,
          String(userProfile.telegramId),
          MessageHelper.constructTrainingSigninByAdminMessage({ date: training.date, groupName: group.name }, this.dateTimeProvider),
        )
      }
    }
    return this.renderTrainingManageMenu(ctx, trainingId, context)
  }

  private handleStaffSelectPaginatedSelect = async (ctx: BotContext, staffUserId: string, context: Record<string, any> = {}) => {
    if (!UserHelper.isAdminRole(ctx)) {
      return BotHelper.safeAnswerCbQuery(ctx, ADMIN_ONLY_MESSAGE, { show_alert: true })
    }

    if (!context.trainingId) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка. Спробуйте ще раз.', { show_alert: true })
      BotHelper.safeDeleteMessage(ctx)
      return
    }

    await this.trainingService.assignSubstituteTrainer(+context.trainingId, staffUserId)

    await this.notifyClientsAboutSubstituteTrainer(ctx, context.trainingId, 'assign')

    BotHelper.safeAnswerCbQuery(ctx, '✅ Тренер успішно призначений на тренування.')

    return this.renderTrainingManageMenu(ctx, context.trainingId, context)
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

    // The slot holds a staff user id or a studio schedule origin (both travel the same way), else a back-button prefix
    const isOrigin = RegexHelper.isValidUuid(backButtonCallbackData) || !!ScheduleKeyboards.parseOrigin(backButtonCallbackData)
    const staffUserId = isOrigin ? backButtonCallbackData : undefined

    if (!trainingId) {
      BotHelper.safeAnswerCbQuery(ctx, '⚠️ Не вдалося повернутися до тренування.', { show_alert: true })
      BotHelper.safeDeleteMessage(ctx)
      return
    }

    if (!UserHelper.isAdminRole(ctx)) {
      const training = await this.trainingService.getTrainingById(+trainingId)
      const group = await this.groupService.getGroupById(training.groupId)
      if (!(await this.canViewGroup(ctx, group, training.trainerId))) {
        return BotHelper.safeAnswerCbQuery(ctx, NOT_YOUR_GROUP_MESSAGE, { show_alert: true })
      }
    }

    return action(trainingId, staffUserId ? null : backButtonCallbackData, staffUserId)
  }

  /** Training actions that change data. Trainers only get read-only keyboards; a forged callback is refused here. */
  private async handleAdminTrainingAction(
    ctx: BotContext,
    action: (trainingId: string, backButtonCallbackData?: string | null, staffUserId?: string | null) => Promise<any>,
  ) {
    if (!UserHelper.isAdminRole(ctx)) {
      return BotHelper.safeAnswerCbQuery(ctx, ADMIN_ONLY_MESSAGE, { show_alert: true })
    }
    return this.handleTrainingAction(ctx, async (trainingId, backButtonCallbackData, staffUserId) => {
      // A training included in a trainer payout is final (the services refuse it too)
      const training = await this.trainingService.getTrainingById(+trainingId)
      if (training?.staffMemberPayoutId) {
        return BotHelper.safeAnswerCbQuery(ctx, COMMON.PAID_OUT_MESSAGE, { show_alert: true })
      }
      return action(trainingId, backButtonCallbackData, staffUserId)
    })
  }

  /** Admins see every group; a trainer sees their own groups, and a training of another group they substitute in. */
  private async canViewGroup(ctx: BotContext, group: { staffMemberId: string | null }, substituteTrainerId?: string | null) {
    if (UserHelper.isAdminRole(ctx)) {
      return true
    }
    const userProfile = await this.userProfileService.getUserProfileById(UserHelper.getUser(ctx).id)
    const ownStaffMemberId = userProfile?.staffMember?.id
    return !!ownStaffMemberId && (group.staffMemberId === ownStaffMemberId || substituteTrainerId === ownStaffMemberId)
  }

  private async notifyClientsAboutSubstituteTrainer(ctx: BotContext, trainingId: string, action: 'assign' | 'deassign') {
    const training = await this.trainingService.getTrainingById(+trainingId)
    const group = await this.groupService.getGroupById(training.groupId)
    const activeSignUps = training.trainingSignups?.filter((signup) => signup.status === TrainingSignupStatusEnum.ACTIVE) || []

    const message = MessageHelper.constructSubstituteTrainerMessage(action, group, training, this.dateTimeProvider)

    const results = await Promise.allSettled(
      activeSignUps
        .map(async (signup) => {
          if (!signup.userProfile?.telegramId) return

          try {
            await BotHelper.safeSendMessage(ctx.telegram, String(signup.userProfile.telegramId), message)
            return { success: true, telegramId: signup.userProfile.telegramId }
          } catch (error) {
            console.error(`Failed to send substitute trainer notification to ${signup.userProfile.telegramId}:`, error)
            return { success: false, telegramId: signup.userProfile.telegramId, error }
          }
        })
        .filter(Boolean),
    )

    const successful = results.filter((result) => result.status === 'fulfilled' && result.value?.success).length
    const failed = results.filter(
      (result) => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value?.success),
    ).length

    this.logger.debug(`Substitute trainer notifications sent. Successful: ${successful}, Failed: ${failed}`)
  }
}
