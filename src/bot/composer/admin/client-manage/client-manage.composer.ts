import { Composer } from 'telegraf'
import { Inject, Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { PassService } from '@app/domain/pass'
import { PassHelper, RegexHelper, UserHelper } from '@app/bot/helpers'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { UserProfileService } from '@app/domain/user-profile'
import { CALLBACK_PREFIX, EDIT_PASS_SCENE_ACTIONS, SCENES, TEditPassSceneAction, TPaginatedMenuRenderOptions } from '@app/bot/libs'
import { CLIENT_SELECT_MENU, ClientSelectPaginatedMenu } from '@app/bot/menus'
import { AdminKeyboards } from '@app/bot/keyboard/storage/admin-keyboards'

@Injectable()
export class ClientManageComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    @Inject(CLIENT_SELECT_MENU) private readonly clientSelectPaginatedMenu: ClientSelectPaginatedMenu,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
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
      this.withClientIdAction(ctx, (clientId) => this.renderPassManageMenu(ctx, clientId))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.EDIT_LENGTH), (ctx) => {
      this.withClientIdAction(ctx, (clientId) => this.handlePassEditAction(ctx, clientId, EDIT_PASS_SCENE_ACTIONS.EDIT_LENGTH))
    })
    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.EDIT_END_DATE), (ctx) => {
      this.withClientIdAction(ctx, (clientId) => this.handlePassEditAction(ctx, clientId, EDIT_PASS_SCENE_ACTIONS.EDIT_END_DATE))
    })
    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.EDIT_START_DATE), (ctx) => {
      this.withClientIdAction(ctx, (clientId) => this.handlePassEditAction(ctx, clientId, EDIT_PASS_SCENE_ACTIONS.EDIT_START_DATE))
    })
  }

  private renderClientSelectPaginatedMenu = async (
    ctx: BotContext,
    renderOptions: TPaginatedMenuRenderOptions = { shouldEdit: false, withExitButton: true },
  ) => {
    const allClients = await this.userProfileService.getAllClientsUserProfiles()

    const data = allClients.map((client) => ({
      id: client.id,
      name: UserHelper.getFullNameFromProfile(client),
    }))

    return this.clientSelectPaginatedMenu.initMenu(ctx, { data }, renderOptions)
  }

  private renderClientManageMenu = async (ctx: BotContext, clientUserId: string) => {
    ctx.answerCbQuery()
    return ctx.editMessageText('👤 Меню управління клієнтом:', AdminKeyboards.clientManageMenu(clientUserId))
  }

  private renderPassManageMenu = async (ctx: BotContext, clientUserId: string) => {
    const userProfile = await this.userProfileService.getUserProfileById(clientUserId)

    if (!userProfile.client) {
      ctx.answerCbQuery('❗️ Помилка. Користувач не є клієнтом.', { show_alert: true })
      return
    }

    const clientPass = await this.passService.findActivePassByClientId(userProfile.client.id, true)

    if (!clientPass) {
      ctx.answerCbQuery('❗️ У клієнта немає активних абонементів.', { show_alert: true })
      return
    }

    ctx.answerCbQuery()

    return PassHelper.renderPassManageMenu(ctx, this.dateTimeProvider, {
      pass: clientPass,
      fullName: UserHelper.getFullNameFromProfile(userProfile),
      clientUserId,
    })
  }

  private handlePassEditAction = async (ctx: BotContext, clientUserId: string, action: TEditPassSceneAction) => {
    const clientUserProfile = await this.userProfileService.getUserProfileById(clientUserId)

    if (!clientUserProfile.client) {
      ctx.answerCbQuery('❗️ Помилка. Користувач не знайдений.', { show_alert: true })
      return
    }

    const originalPass = await this.passService.findActivePassByClientId(clientUserProfile.client.id, true)

    if (!originalPass) {
      ctx.answerCbQuery('❗️ У клієнта немає активних абонементів.', { show_alert: true })
      return
    }

    ctx.answerCbQuery()
    ctx.deleteMessage()

    return ctx.scene.enter(SCENES.EDIT_PASS, {
      action,
      passId: originalPass.id,
      clientUserId,
      clientUserProfile,
      originalPass,
    })
  }

  withClientIdAction = (ctx: BotContext, action: (clientId: string) => Promise<any>) => {
    const [clientId] = RegexHelper.getMatchGroupValue(ctx)

    if (!clientId) {
      ctx.answerCbQuery('❗️ Помилка. Невірні дані кнопки.', { show_alert: true })
      ctx.deleteMessage()
      return
    }

    return action(clientId)
  }
}
