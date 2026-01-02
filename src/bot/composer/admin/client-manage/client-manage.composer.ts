import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { PassService } from '@app/domain/pass'
import { BotHelper, PassHelper, RegexHelper, UserHelper } from '@app/bot/helpers'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { UserProfileService } from '@app/domain/user-profile'
import {
  CALLBACK_PREFIX,
  CLIENT_STATUS_CHANGE_ACTIONS,
  EDIT_PASS_SCENE_ACTIONS,
  EDIT_USER_PROFILE_SCENE_ACTIONS,
  SCENES,
  TClientStatusChangeAction,
  TEditPassSceneAction,
  TEditUserProfileSceneAction,
  TPaginatedMenuRenderOptions,
  UserProfileWithClient,
  UserProfileWithRoleRelations,
} from '@app/bot/libs'
import { ClientSelectPaginatedMenu } from '@app/bot/menus'
import { AdminKeyboards } from '@app/bot/keyboard/storage/admin-keyboards'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { AuditLogActions, AuditLogTrigger, PassStatusEnum, UserProfileStatusEnum } from '@app/libs'
import { ClientHelper } from '@app/bot/helpers/client.helper'
import { TrainingSignupService } from '@app/domain/training-signup'
import { AuditLogHelper } from '@app/bot/helpers/audit-log.helper'

@Injectable()
export class ClientManageComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly clientSelectPaginatedMenu: ClientSelectPaginatedMenu,
    private readonly userProfileService: UserProfileService,
    private readonly trainingSignupService: TrainingSignupService,
    private readonly passService: PassService,
  ) {
    this.composer = new Composer<BotContext>()

    this.useMenusMiddleware()

    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  useMenusMiddleware() {
    this.composer.use(
      this.clientSelectPaginatedMenu.middleware({
        callbackPrefix: CALLBACK_PREFIX.CLIENT.MANAGE.MENU,
        promptMessage: '👤 Оберіть клієнта зі списку:',
        noOptionsMessage: '👤 Немає доступних клієнтів.',
        onItemSelect: this.renderClientManageMenu,
      }),
    )
  }

  initComposerHandlers() {
    this.composer.hears(BUTTON_PATTERNS.CLIENTS, (ctx) => this.renderClientSelectPaginatedMenu(ctx))
    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.BACK_TO_CLIENT_LIST), (ctx) => {
      return this.renderClientSelectPaginatedMenu(ctx, { shouldEdit: true, withExitButton: true })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.MANAGE), (ctx) => {
      this.withClientIdAction(ctx, (clientUserProfile) => this.renderPassManageMenu(ctx, clientUserProfile))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.ADD_NEW), (ctx) => {
      this.withClientIdAction(ctx, (clientUserProfile) => this.handleAddNewPassAction(ctx, clientUserProfile))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.ACTIVATE), (ctx) => {
      this.withClientIdAction(ctx, (clientUserProfile) => this.handleActivatePassAction(ctx, clientUserProfile))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.EDIT_LENGTH), (ctx) => {
      this.withClientIdAction(ctx, (clientUserProfile) =>
        this.handlePassEditAction(ctx, clientUserProfile, EDIT_PASS_SCENE_ACTIONS.EDIT_LENGTH),
      )
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.EDIT_END_DATE), (ctx) => {
      this.withClientIdAction(ctx, (clientUserProfile) =>
        this.handlePassEditAction(ctx, clientUserProfile, EDIT_PASS_SCENE_ACTIONS.EDIT_END_DATE),
      )
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.EDIT_START_DATE), (ctx) => {
      this.withClientIdAction(ctx, (clientUserProfile) =>
        this.handlePassEditAction(ctx, clientUserProfile, EDIT_PASS_SCENE_ACTIONS.EDIT_START_DATE),
      )
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.UNARCHIVE), (ctx) => {
      this.withClientIdAction(ctx, (clientUserProfile) =>
        this.handleChangeStatusAction(ctx, clientUserProfile, CLIENT_STATUS_CHANGE_ACTIONS.UNARCHIVE),
      )
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.ARCHIVE), (ctx) => {
      this.withClientIdAction(ctx, (clientUserProfile) =>
        this.handleChangeStatusAction(ctx, clientUserProfile, CLIENT_STATUS_CHANGE_ACTIONS.ARCHIVE),
      )
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.BACK_TO_MENU), (ctx) => {
      this.withClientIdAction(ctx, (clientUserProfile) => this.renderClientManageMenu(ctx, clientUserProfile.id))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PROFILE.EDIT), (ctx) => {
      this.withClientIdAction(ctx, (clientUserProfile) => this.renderClientEditMenu(ctx, clientUserProfile))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PROFILE.EDIT_NAME), (ctx) => {
      this.withClientIdAction(ctx, (clientUserProfile) =>
        this.handleUserProfileEditAction(ctx, clientUserProfile, EDIT_USER_PROFILE_SCENE_ACTIONS.EDIT_NAME),
      )
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PROFILE.EDIT_PHONE), (ctx) => {
      this.withClientIdAction(ctx, (clientUserProfile) =>
        this.handleUserProfileEditAction(ctx, clientUserProfile, EDIT_USER_PROFILE_SCENE_ACTIONS.EDIT_PHONE),
      )
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PROFILE.EDIT_DATE_OF_BIRTH), (ctx) => {
      this.withClientIdAction(ctx, (clientUserProfile) =>
        this.handleUserProfileEditAction(ctx, clientUserProfile, EDIT_USER_PROFILE_SCENE_ACTIONS.EDIT_DATE_OF_BIRTH),
      )
    })
  }

  private renderClientSelectPaginatedMenu = async (
    ctx: BotContext,
    renderOptions: TPaginatedMenuRenderOptions = { shouldEdit: false, withExitButton: true },
  ) => {
    const allClients = await this.userProfileService.getClientsUserProfiles({ withArchived: true })

    const data = allClients.map((client) => {
      const activePass = client.client?.pass.find((p) => p.status === PassStatusEnum.ACTIVE)

      return {
        id: client.id,
        name: UserHelper.getDisplayName(client),
        status: client.status,
        availableSlots: activePass?.availableSlots ?? null,
        hasActivePass: !!activePass,
      }
    })

    return this.clientSelectPaginatedMenu.initMenu(ctx, { data }, renderOptions)
  }

  private renderClientManageMenu = async (ctx: BotContext, clientUserId: string) => {
    const userProfile = await this.userProfileService.getUserProfileById(clientUserId)

    if (!userProfile?.client) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка. Користувач не є клієнтом.', { show_alert: true })
      ctx.deleteMessage()
      return
    }
    BotHelper.safeAnswerCbQuery(ctx)

    return ClientHelper.renderClientManageMenu(ctx, userProfile as UserProfileWithClient)
  }

  private renderPassManageMenu = async (ctx: BotContext, clientUserProfile: UserProfileWithClient) => {
    const clientPass = await this.passService.findActivePassByClientId(clientUserProfile.client.id, { withExpired: true })

    if (!clientPass) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ У клієнта немає активних абонементів.', { show_alert: true })
      return
    }

    BotHelper.safeAnswerCbQuery(ctx)

    const trainingSignups = await this.trainingSignupService.getTrainingSignupByPassId(clientPass.id)

    return PassHelper.renderPassManageMenu(ctx, this.dateTimeProvider, {
      pass: clientPass,
      fullName: UserHelper.getDisplayName(clientUserProfile),
      clientUserId: clientUserProfile.id,
      trainingSignups,
    })
  }

  private handlePassEditAction = async (
    ctx: BotContext,
    clientUserProfile: UserProfileWithClient,
    action: TEditPassSceneAction,
  ) => {
    const originalPass = await this.passService.findActivePassByClientId(clientUserProfile.client.id, { withExpired: true })

    if (!originalPass) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ У клієнта немає активних абонементів.', { show_alert: true })
      return
    }

    BotHelper.safeAnswerCbQuery(ctx)
    ctx.deleteMessage()

    return ctx.scene.enter(SCENES.EDIT_PASS, {
      action,
      passId: originalPass.id,
      clientUserId: clientUserProfile.id,
      clientUserProfile,
      originalPass,
    })
  }
  private handleUserProfileEditAction = async (
    ctx: BotContext,
    clientUserProfile: UserProfileWithClient,
    action: TEditUserProfileSceneAction,
  ) => {
    BotHelper.safeAnswerCbQuery(ctx)
    ctx.deleteMessage()
    return ctx.scene.enter(SCENES.EDIT_USER_PROFILE, {
      action,
      clientUserProfile,
    })
  }

  private handleChangeStatusAction = async (
    ctx: BotContext,
    clientUserProfile: UserProfileWithClient,
    action: TClientStatusChangeAction,
  ) => {
    let canRenderMenu = false
    if (action === CLIENT_STATUS_CHANGE_ACTIONS.ARCHIVE) {
      const activePass = await this.passService.findActivePassByClientId(clientUserProfile.client.id)
      if (activePass) {
        BotHelper.safeAnswerCbQuery(ctx, '❗️ Клієнта з активним абонементом не можна заархівувати.', { show_alert: true })
        return
      }
      if (UserHelper.isArchivedProfile(clientUserProfile)) {
        BotHelper.safeAnswerCbQuery(ctx, '❗️ Клієнт вже в архіві.', { show_alert: true })
        return
      }
      await this.userProfileService.updateUserProfile(clientUserProfile.id, { status: UserProfileStatusEnum.ARCHIVED })
      BotHelper.safeAnswerCbQuery(ctx, '✅ Клієнта успішно заархівовано.')
      canRenderMenu = true
    }

    if (action === CLIENT_STATUS_CHANGE_ACTIONS.UNARCHIVE) {
      if (!UserHelper.isArchivedProfile(clientUserProfile)) {
        BotHelper.safeAnswerCbQuery(ctx, '❗️ Клієнт не в архіві.', { show_alert: true })
        return
      }
      await this.userProfileService.updateUserProfile(clientUserProfile.id, { status: UserProfileStatusEnum.ACTIVE })
      BotHelper.safeAnswerCbQuery(ctx, '✅ Клієнта успішно відновлено з архіву.')
      canRenderMenu = true
    }

    if (canRenderMenu) {
      return this.renderClientManageMenu(ctx, clientUserProfile.id)
    }
  }

  private renderClientEditMenu = async (ctx: BotContext, clientUserProfile: UserProfileWithRoleRelations) => {
    const message = MessageHelper.getClientManageHeaderMessage(clientUserProfile)
    return ctx.editMessageText(message, { ...AdminKeyboards.userProfileEditMenu(clientUserProfile.id), parse_mode: 'HTML' })
  }

  private handleActivatePassAction = async (ctx: BotContext, clientUserProfile: UserProfileWithClient) => {
    const originalPass = await this.passService.findActivePassByClientId(clientUserProfile.client.id, { withExpired: true })

    if (!originalPass) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ У клієнта немає активних абонементів.', { show_alert: true })
      ctx.deleteMessage()
      return
    }
    if (PassHelper.isPassActivated(originalPass)) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Абонемент вже активований.', { show_alert: true })
      ctx.deleteMessage()
      return
    }

    const [_, logOperations] = await this.passService.activatePass(originalPass.id)
    AuditLogHelper.startAction(ctx, AuditLogActions.PASS_ACTIVATE_CONFIRM, AuditLogTrigger.ADMIN_ACTION, logOperations)
    BotHelper.safeAnswerCbQuery(ctx, '✅ Абонемент успішно активовано.')
    return this.renderPassManageMenu(ctx, clientUserProfile)
  }

  private handleAddNewPassAction = async (ctx: BotContext, clientUserProfile: UserProfileWithClient) => {
    console.log(clientUserProfile, 'clientUserProfile ')
    ctx.reply('✅ Перехід до створення нового абонементу для клієнта.')
  }

  private withClientIdAction = async (ctx: BotContext, action: (userProfile: UserProfileWithClient) => Promise<any>) => {
    const [clientUserId] = RegexHelper.getMatchGroupValue(ctx)

    if (!clientUserId) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка. Невірні дані кнопки.', { show_alert: true })
      ctx.deleteMessage()
      return
    }

    const userProfile = await this.userProfileService.getUserProfileById(clientUserId)

    if (!userProfile || userProfile.client === null) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка. Користувач не є клієнтом.', { show_alert: true })
      ctx.deleteMessage()
      return
    }

    return action(userProfile as UserProfileWithClient)
  }
}
