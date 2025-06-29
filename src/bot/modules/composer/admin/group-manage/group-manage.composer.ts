import { Composer } from 'telegraf'
import { Inject, Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { PATTERNS_ADMIN } from '@app/bot/static/patterns'
import {
  ClientSelectPaginatedMenu,
  GroupSelectPaginatedMenu,
  TrainingSelectAdminPaginatedMenu,
  CLIENT_SIGNOUT_MENU,
} from '@app/bot/modules/inline-menu'
import { CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { AdminKeyboards } from '@app/bot/modules/keyboard/storage'
import { GroupService } from '@app/domain/group'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { RegexHelper, UserHelper } from '@app/bot/helpers'
import { TrainingService } from '@app/domain/training'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { TrainingSelectModel } from '@app/infrastructure/database'
import { TrainingSignupService } from '@app/domain/training-signup'
import { API, TrainingSignupStatusEnum } from '@app/libs'

@Injectable()
export class GroupManageComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly groupSelectPaginatedMenu: GroupSelectPaginatedMenu,
    private readonly trainingSelectAdminPaginatedMenu: TrainingSelectAdminPaginatedMenu,
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
        promptMessage: 'Виберіть групу:',
        noOptionsMessage: 'На жаль, немає активих груп для управління.',
        onItemSelect: this.handleGroupPaginatedSelect,
      }),
    )
    this.composer.use(
      this.trainingSelectAdminPaginatedMenu.middleware({
        callbackPrefix: CALLBACK_PREFIX.STAFF.GROUP.TRAININGS_SELECT,
        noOptionsMessage: 'На жаль, немає доступних тренувань',
        onItemSelect: this.handleTrainingPaginatedSelect,
      }),
    )
    this.composer.use(
      this.clientSelectSignOutPaginatedMenu.middleware({
        callbackPrefix: CALLBACK_PREFIX.STAFF.TRAINING.CLIENT_SIGNOUT_SELECT,
        promptMessage: 'Виберіть клієнта для скасування запису:',
        noOptionsMessage: 'На це тренування немає активних записів',
        onItemSelect: this.handleClientSignOutPaginatedSelect,
      }),
    )
  }

  initComposerHandlers() {
    this.composer.hears(PATTERNS_ADMIN.GROUPS, async (ctx: BotContext) => {
      return this.groupSelectPaginatedMenu.initMenu(ctx, { userId: UserHelper.getUser(ctx).id, isAdmin: true })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.GROUP.TRAININGS), async (ctx: BotContext) => {
      ctx.answerCbQuery()
      return this.renderTrainingSelectMenu(ctx, { shouldEdit: false })
    })

    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.GROUP.BACK_TO_SELECT),
      async (ctx: BotContext) => {
        ctx.answerCbQuery()
        return this.groupSelectPaginatedMenu.initMenu(ctx, { userId: UserHelper.getUser(ctx).id }, { shouldEdit: true })
      },
    )

    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.GROUP.BACK_TO_TRAININGS_SELECT),
      async (ctx: BotContext) => {
        ctx.answerCbQuery()
        return this.renderTrainingSelectMenu(ctx, { shouldEdit: true })
      },
    )

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.CANCEL), async (ctx: BotContext) => {
      ctx.answerCbQuery()
      const [_, trainingId] = ctx['match']
      const { training, signups } = await this.trainingService.cancelTrainingById(trainingId)

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

      return this.renderTraininManageMenu(ctx, training)
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.ACTIVATE), async (ctx: BotContext) => {
      ctx.answerCbQuery()
      const [_, trainingId] = ctx['match']
      const { training, signups } = await this.trainingService.activateTrainingById(trainingId)
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
      return this.renderTraininManageMenu(ctx, training)
    })

    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.BACK_TO_MANAGE),
      async (ctx: BotContext) => {
        return this.handleTrainingPaginatedSelect(ctx, ctx['match'][1])
      },
    )

    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.SIGNUPS_ACTIVE),
      async (ctx: BotContext) => {
        ctx.answerCbQuery()
        const [_, trainingId] = ctx['match']
        const activeSignUps = await this.trainingSignupService.getTrainingActiveSignups(trainingId)
        return ctx.editMessageText(MessageHelper.constructSignupListMessage(activeSignUps, TrainingSignupStatusEnum.ACTIVE), {
          parse_mode: 'HTML',
          ...AdminKeyboards.backForTrainingManage(trainingId),
        })
      },
    )

    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.SIGNUPS_CANCELED),
      async (ctx: BotContext) => {
        ctx.answerCbQuery()
        const [_, trainingId] = ctx['match']
        const canceledSignups = await this.trainingSignupService.getTrainingCancelledSignups(trainingId)
        return ctx.editMessageText(MessageHelper.constructSignupListMessage(canceledSignups, TrainingSignupStatusEnum.CANCELED), {
          parse_mode: 'HTML',
          ...AdminKeyboards.backForTrainingManage(trainingId),
        })
      },
    )

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.SIGN_IN), async (ctx: BotContext) => {
      ctx.answerCbQuery()
      const [_, trainingId] = ctx['match']
      return ctx.scene.enter(SCENES.SIGN_IN_CLIENT, { trainingId })
      console.log('Sign in action triggered for trainingId:', trainingId)
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.TRAINING.SIGN_OUT), async (ctx: BotContext) => {
      ctx.answerCbQuery()
      const [_, trainingId] = ctx['match']
      const activeSignUps = await this.trainingSignupService.getTrainingActiveSignups(trainingId)
      console.log(activeSignUps, 'activeSignUps')
      const data = activeSignUps.map((signup) => ({
        name: `${signup.userProfile?.firstName} ${signup.userProfile?.lastName}`,
        id: signup.id,
      }))
      return this.clientSelectSignOutPaginatedMenu.initMenu(ctx, { data })
    })
  }

  private renderTrainingSelectMenu = async (ctx: BotContext, { shouldEdit }: { shouldEdit: boolean }) => {
    const [_, groupId] = ctx['match']
    const group = await this.groupService.getGroupById(groupId)
    return this.trainingSelectAdminPaginatedMenu.initMenu(ctx, { group }, { shouldEdit })
  }

  private renderTraininManageMenu = async (ctx: BotContext, updatedTraining: TrainingSelectModel) => {
    const [training, group] = await Promise.all([
      this.trainingService.getTrainingById(updatedTraining.id),
      this.groupService.getGroupById(updatedTraining.groupId),
    ])
    return ctx.editMessageText(MessageHelper.constructTrainingSelectMessage(training, group, this.dateTimeProvider), {
      parse_mode: 'HTML',
      ...AdminKeyboards.trainingManageMenu(training),
    })
  }

  private handleGroupPaginatedSelect = async (ctx: BotContext, groupId: string) => {
    ctx.answerCbQuery()
    const group = await this.groupService.getGroupById(groupId)
    return ctx.editMessageText(MessageHelper.constructGroupSelectMessage(group), {
      parse_mode: 'HTML',
      ...AdminKeyboards.groupManageMenu(groupId),
    })
  }

  private handleTrainingPaginatedSelect = async (ctx: BotContext, trainingId: string) => {
    await ctx.answerCbQuery()
    const training = await this.trainingService.getTrainingById(trainingId)
    const group = await this.groupService.getGroupById(training.groupId)
    return ctx.editMessageText(MessageHelper.constructTrainingSelectMessage(training, group, this.dateTimeProvider), {
      parse_mode: 'HTML',
      ...AdminKeyboards.trainingManageMenu(training),
    })
  }

  private handleClientSignOutPaginatedSelect = async (ctx: BotContext, signupId: string) => {
    const response = await this.trainingSignupService.signOutFromTrainingAsAdminViaTelegram(signupId)

    if (response.status === API.RESPONSE.ERROR_STRING) {
      return ctx.answerCbQuery(response.message, { show_alert: true })
    }
    ctx.answerCbQuery()

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
}
