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
  SCENES,
  TClientStatusChangeAction,
  TEditPassSceneAction,
  TPaginatedMenuRenderOptions,
  UserProfileWithClient,
  UserProfileWithRoleRelations,
} from '@app/bot/libs'
import { ClientSelectPaginatedMenu } from '@app/bot/menus'
import { AdminKeyboards } from '@app/bot/keyboard/storage/admin-keyboards'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { UserProfileStatusEnum } from '@app/libs'

@Injectable()
export class ClientManageComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly clientSelectPaginatedMenu: ClientSelectPaginatedMenu,
    private readonly userProfileService: UserProfileService,
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
  }

  private renderClientSelectPaginatedMenu = async (
    ctx: BotContext,
    renderOptions: TPaginatedMenuRenderOptions = { shouldEdit: false, withExitButton: true },
  ) => {
    const allClients = await this.userProfileService.getClientsUserProfilesForManage()

    const data = allClients.map((client) => ({
      id: client.id,
      name: UserHelper.getFullNameFromProfile(client),
      status: client.status,
    }))

    return this.clientSelectPaginatedMenu.initMenu(ctx, { data }, renderOptions)
  }

  private renderClientManageMenu = async (ctx: BotContext, clientUserId: string) => {
    BotHelper.safeAnswerCbQuery(ctx)
    const userProfile = await this.userProfileService.getUserProfileById(clientUserId)
    const isArchived = UserHelper.isArchivedProfile(userProfile)
    const message = MessageHelper.getClientManageHeaderMessage(userProfile)
    return ctx.editMessageText(message, { ...AdminKeyboards.clientManageMenu(clientUserId, isArchived), parse_mode: 'HTML' })
  }

  private renderPassManageMenu = async (ctx: BotContext, clientUserProfile: UserProfileWithClient) => {
    const clientPass = await this.passService.findActivePassByClientId(clientUserProfile.client.id, true)

    if (!clientPass) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ У клієнта немає активних абонементів.', { show_alert: true })
      return
    }

    BotHelper.safeAnswerCbQuery(ctx)

    return PassHelper.renderPassManageMenu(ctx, this.dateTimeProvider, {
      pass: clientPass,
      fullName: UserHelper.getFullNameFromProfile(clientUserProfile),
      clientUserId: clientUserProfile.id,
    })
  }

  private handlePassEditAction = async (
    ctx: BotContext,
    clientUserProfile: UserProfileWithClient,
    action: TEditPassSceneAction,
  ) => {
    const originalPass = await this.passService.findActivePassByClientId(clientUserProfile.client.id, true)

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

  withClientIdAction = async (ctx: BotContext, action: (userProfile: UserProfileWithClient) => Promise<any>) => {
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
