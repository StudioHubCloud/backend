import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { PassSelectionHelper, PassService } from '@app/domain/pass'
import { BotHelper, PassHelper, PersonalTrainingHelper, RegexHelper, UserHelper } from '@app/bot/helpers'
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
  TPassGroupChange,
  UserProfileWithClient,
  UserProfileWithRoleRelations,
} from '@app/bot/libs'
import { ClientSelectPaginatedMenu } from '@app/bot/menus'
import { AdminKeyboards } from '@app/bot/keyboard/storage/admin-keyboards'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import {
  AuditLogActions,
  AuditLogTrigger,
  PassGroupModeEnum,
  PassStatusEnum,
  PassTemplateTypeEnum,
  UserProfileStatusEnum,
} from '@app/libs'
import { ClientHelper } from '@app/bot/helpers/client.helper'
import { TrainingSignupService } from '@app/domain/training-signup'
import { PersonalTrainingSignupService } from '@app/domain/personal-training-signup'
import { PersonalTrainingKeyboards } from '@app/bot/keyboard/storage'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { AuditLogHelper } from '@app/bot/helpers/audit-log.helper'
import { GroupService } from '@app/domain/group'
import { GroupAgeRestrictionService } from '@app/domain/group-age-restriction'

type TClientPass = NonNullable<Awaited<ReturnType<PassService['findStudioPassById']>>>

@Injectable()
export class ClientManageComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly clientSelectPaginatedMenu: ClientSelectPaginatedMenu,
    private readonly userProfileService: UserProfileService,
    private readonly trainingSignupService: TrainingSignupService,
    private readonly passService: PassService,
    private readonly personalTrainingSignupService: PersonalTrainingSignupService,
    private readonly groupService: GroupService,
    private readonly groupAgeRestrictionService: GroupAgeRestrictionService,
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
      return this.withClientIdAction(ctx, (clientUserProfile) => this.renderPassManageMenu(ctx, clientUserProfile))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.ADD_NEW), (ctx) => {
      return this.withClientIdAction(ctx, (clientUserProfile) => this.handleAddNewPassAction(ctx, clientUserProfile))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.VIEW), (ctx) => {
      return this.withPassIdAction(ctx, (clientUserProfile, pass) => this.renderPassManageMenu(ctx, clientUserProfile, pass.id))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.ACTIVATE), (ctx) => {
      return this.withPassIdAction(ctx, (clientUserProfile, pass) => this.handleActivatePassAction(ctx, clientUserProfile, pass))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.FREEZE), (ctx) => {
      return this.withPassIdAction(ctx, (clientUserProfile, pass) => this.handleFreezePassAction(ctx, clientUserProfile, pass))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.GROUPS), (ctx) => {
      return this.withPassIdAction(ctx, (clientUserProfile, pass) => this.handlePassGroupsAction(ctx, clientUserProfile, pass))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.GROUP_TOGGLE), (ctx) => {
      return this.withPassIdAction(ctx, (clientUserProfile, pass) => this.handlePassGroupToggleAction(ctx, clientUserProfile, pass))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.GROUP_CONFIRM), (ctx) => {
      return this.withPassIdAction(ctx, (clientUserProfile, pass) => this.handlePassGroupConfirmAction(ctx, clientUserProfile, pass))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PERSONAL_TRAINING.REGISTER), (ctx) => {
      return this.withClientIdAction(ctx, (clientUserProfile) => this.handleRegisterPersonalTrainingAction(ctx, clientUserProfile))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PERSONAL_TRAINING.CANCEL_LIST), (ctx) => {
      return this.withClientIdAction(ctx, (clientUserProfile) => this.renderPersonalTrainingCancelList(ctx, clientUserProfile))
    })

    this.composer.action(
      RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PERSONAL_TRAINING.CANCEL_SELECT),
      this.handleCancelPersonalTrainingAction,
    )

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.EDIT_LENGTH), (ctx) => {
      return this.withPassIdAction(ctx, (clientUserProfile, pass) =>
        this.handlePassEditAction(ctx, clientUserProfile, EDIT_PASS_SCENE_ACTIONS.EDIT_LENGTH, pass),
      )
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.EDIT_END_DATE), (ctx) => {
      return this.withPassIdAction(ctx, (clientUserProfile, pass) =>
        this.handlePassEditAction(ctx, clientUserProfile, EDIT_PASS_SCENE_ACTIONS.EDIT_END_DATE, pass),
      )
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PASS.EDIT_START_DATE), (ctx) => {
      return this.withPassIdAction(ctx, (clientUserProfile, pass) =>
        this.handlePassEditAction(ctx, clientUserProfile, EDIT_PASS_SCENE_ACTIONS.EDIT_START_DATE, pass),
      )
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.UNARCHIVE), (ctx) => {
      return this.withClientIdAction(ctx, (clientUserProfile) =>
        this.handleChangeStatusAction(ctx, clientUserProfile, CLIENT_STATUS_CHANGE_ACTIONS.UNARCHIVE),
      )
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.ARCHIVE), (ctx) => {
      return this.withClientIdAction(ctx, (clientUserProfile) =>
        this.handleChangeStatusAction(ctx, clientUserProfile, CLIENT_STATUS_CHANGE_ACTIONS.ARCHIVE),
      )
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.BACK_TO_MENU), (ctx) => {
      return this.withClientIdAction(ctx, (clientUserProfile) => this.renderClientManageMenu(ctx, clientUserProfile.id))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PROFILE.EDIT), (ctx) => {
      return this.withClientIdAction(ctx, (clientUserProfile) => this.renderClientEditMenu(ctx, clientUserProfile))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PROFILE.EDIT_NAME), (ctx) => {
      return this.withClientIdAction(ctx, (clientUserProfile) =>
        this.handleUserProfileEditAction(ctx, clientUserProfile, EDIT_USER_PROFILE_SCENE_ACTIONS.EDIT_NAME),
      )
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PROFILE.EDIT_PHONE), (ctx) => {
      return this.withClientIdAction(ctx, (clientUserProfile) =>
        this.handleUserProfileEditAction(ctx, clientUserProfile, EDIT_USER_PROFILE_SCENE_ACTIONS.EDIT_PHONE),
      )
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.MANAGE.PROFILE.EDIT_DATE_OF_BIRTH), (ctx) => {
      return this.withClientIdAction(ctx, (clientUserProfile) =>
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
      BotHelper.safeDeleteMessage(ctx)
      return
    }
    BotHelper.safeAnswerCbQuery(ctx)

    const family = await this.userProfileService.getFamily(userProfile.id)
    return ClientHelper.renderClientManageMenu(ctx, userProfile as UserProfileWithClient, true, family)
  }

  /** The chosen pass (`passId`), else the client's current one; with several active passes the card switches between them. */
  private renderPassManageMenu = async (ctx: BotContext, clientUserProfile: UserProfileWithClient, passId?: string | null) => {
    const clientPass = passId
      ? await this.passService.findStudioPassById(passId)
      : await this.passService.findActivePassByClientId(clientUserProfile.client.id, { withExpired: true })
    const { passes: activePasses } = await this.passService.findActivePassesByClientId(clientUserProfile.client.id)

    if (!clientPass) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ У клієнта немає активних абонементів.', { show_alert: true })
      return
    }

    BotHelper.safeAnswerCbQuery(ctx)

    const isIndividualPass = clientPass.passTemplate.type === PassTemplateTypeEnum.INDIVIDUAL

    // An individual pass is spent on 1:1 sessions, so it shows those instead of group signups.
    if (isIndividualPass) {
      const personalTrainings = await this.personalTrainingSignupService.getClientSignups(clientUserProfile.client.id)

      return PassHelper.renderPassManageMenu(ctx, this.dateTimeProvider, {
        pass: clientPass,
        fullName: UserHelper.getDisplayName(clientUserProfile),
        clientUserId: clientUserProfile.id,
        personalTrainingsBlock: PersonalTrainingHelper.getAdminHistoryBlock(personalTrainings, this.dateTimeProvider),
        activePasses,
      })
    }

    const trainingSignups = await this.trainingSignupService.getTrainingSignupByPassId(clientPass.id)

    return PassHelper.renderPassManageMenu(ctx, this.dateTimeProvider, {
      pass: clientPass,
      fullName: UserHelper.getDisplayName(clientUserProfile),
      clientUserId: clientUserProfile.id,
      trainingSignups,
      activePasses,
    })
  }

  private handleRegisterPersonalTrainingAction = async (ctx: BotContext, clientUserProfile: UserProfileWithClient) => {
    BotHelper.safeAnswerCbQuery(ctx)
    BotHelper.safeDeleteMessage(ctx)
    return ctx.scene.enter(SCENES.PERSONAL_TRAINING_REGISTER, { clientUserProfile })
  }

  private renderPersonalTrainingCancelList = async (ctx: BotContext, clientUserProfile: UserProfileWithClient) => {
    const scheduled = PersonalTrainingHelper.filterCancellable(
      ctx,
      await this.personalTrainingSignupService.getScheduledForClient(clientUserProfile.client.id),
    )

    if (!scheduled.length) {
      return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.NO_TRAININGS_TO_CANCEL, {
        show_alert: true,
      })
    }

    BotHelper.safeAnswerCbQuery(ctx)

    return BotHelper.safeEditMessageText(
      ctx,
      '🗑️ Оберіть індивідуальне тренування, яке потрібно скасувати:',
      PersonalTrainingKeyboards.cancelList(scheduled, clientUserProfile.id, this.dateTimeProvider),
    )
  }

  private handleCancelPersonalTrainingAction = async (ctx: BotContext) => {
    const [signupId] = RegexHelper.getMatchGroupValue(ctx)

    if (!signupId) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка. Невірні дані кнопки.', { show_alert: true })
      return BotHelper.safeDeleteMessage(ctx)
    }

    const signup = await PersonalTrainingHelper.cancelByAdmin(
      ctx,
      signupId,
      {
        personalTrainingSignupService: this.personalTrainingSignupService,
        passService: this.passService,
        userProfileService: this.userProfileService,
      },
      this.dateTimeProvider,
    )

    if (!signup) {
      return
    }

    const clientUserProfile = await this.userProfileService.getUserProfileById(signup.client!.userProfileId)
    return this.renderPassManageMenu(ctx, clientUserProfile as UserProfileWithClient, signup.passId)
  }

  private handlePassEditAction = async (
    ctx: BotContext,
    clientUserProfile: UserProfileWithClient,
    action: TEditPassSceneAction,
    originalPass: TClientPass,
  ) => {
    BotHelper.safeAnswerCbQuery(ctx)
    BotHelper.safeDeleteMessage(ctx)

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
    BotHelper.safeDeleteMessage(ctx)
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
    return BotHelper.safeEditMessageText(ctx, message, AdminKeyboards.userProfileEditMenu(clientUserProfile.id))
  }

  private handleActivatePassAction = async (ctx: BotContext, clientUserProfile: UserProfileWithClient, originalPass: TClientPass) => {
    if (PassHelper.isPassActivated(originalPass)) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Абонемент вже активований.', { show_alert: true })
      BotHelper.safeDeleteMessage(ctx)
      return
    }

    const [_, logOperations] = await this.passService.activatePass(originalPass.id)
    AuditLogHelper.startAction(ctx, AuditLogActions.PASS_ACTIVATE_CONFIRM, AuditLogTrigger.ADMIN_ACTION, logOperations)
    BotHelper.safeAnswerCbQuery(ctx, '✅ Абонемент успішно активовано.')
    return this.renderPassManageMenu(ctx, clientUserProfile, originalPass.id)
  }

  private handleFreezePassAction = async (ctx: BotContext, clientUserProfile: UserProfileWithClient, pass: TClientPass) => {
    if (!UserHelper.isAdminRole(ctx)) {
      return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.PASS_FREEZE.NOT_ALLOWED, { show_alert: true })
    }

    const refusal = PassSelectionHelper.getFreezeRefusal(pass, this.passService.getTodayDateString())
    if (refusal) {
      return BotHelper.safeAnswerCbQuery(ctx, PassSelectionHelper.getFreezeRefusalMessage(refusal), { show_alert: true })
    }

    BotHelper.safeAnswerCbQuery(ctx)
    BotHelper.safeDeleteMessage(ctx)
    return ctx.scene.enter(SCENES.PASS_FREEZE, { passId: pass.id, clientUserId: clientUserProfile.id })
  }

  /** Why the admin can't change this pass's groups (alert), or null: admins only, an active FIXED group pass. */
  private getPassGroupsRefusal(ctx: BotContext, pass: TClientPass): string | null {
    if (!UserHelper.isAdminRole(ctx)) {
      return MESSAGES_SCENE.PASS_GROUP.NOT_ALLOWED
    }
    const isFixed = pass.passTemplate.type === PassTemplateTypeEnum.GROUP && pass.groupMode === PassGroupModeEnum.FIXED
    return isFixed && pass.status === PassStatusEnum.ACTIVE ? null : MESSAGES_SCENE.PASS_GROUP.NOT_FIXED
  }

  private handlePassGroupsAction = async (ctx: BotContext, clientUserProfile: UserProfileWithClient, pass: TClientPass) => {
    const refusal = this.getPassGroupsRefusal(ctx, pass)
    if (refusal) {
      return BotHelper.safeAnswerCbQuery(ctx, refusal, { show_alert: true })
    }
    BotHelper.safeAnswerCbQuery(ctx)
    return this.renderPassGroups(ctx, clientUserProfile, pass)
  }

  /**
   * A tap on a group in «👯‍♀️ Групи» asks first: add (PRO) / unbind (PRO) / replace (an ordinary pass). The last group
   * can't be removed.
   */
  private handlePassGroupToggleAction = async (ctx: BotContext, clientUserProfile: UserProfileWithClient, pass: TClientPass) => {
    const [, groupIdValue] = RegexHelper.getMatchGroupValue(ctx)
    const picked = await this.getPassGroupPick(ctx, pass, Number(groupIdValue))
    if (!picked) return

    const { group, change } = picked
    if (change === 'last_group') {
      return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.PASS_GROUP.LAST_GROUP, { show_alert: true })
    }

    const fullName = UserHelper.getDisplayName(clientUserProfile)
    const passName = pass.passTemplate.name
    const ageException = change !== 'remove' && !(await this.isGroupForClientAge(clientUserProfile, group.id))
    const message = {
      add: () => MESSAGES_SCENE.PASS_GROUP.ADD_CONFIRM({ fullName, passName, groupName: group.name, ageException }),
      remove: () => MESSAGES_SCENE.PASS_GROUP.REMOVE_CONFIRM({ fullName, passName, groupName: group.name }),
      replace: () =>
        MESSAGES_SCENE.PASS_GROUP.REPLACE_CONFIRM({
          fullName,
          passName,
          fromName: PassSelectionHelper.getGroupNames(pass).join(', '),
          toName: group.name,
          ageException,
        }),
    }[change]()

    BotHelper.safeAnswerCbQuery(ctx)
    return BotHelper.safeEditMessageText(ctx, message, AdminKeyboards.passGroupConfirm(pass.id, group.id, change))
  }

  /**
   * "Так, додати / прибрати / замінити": applied only if the pass still needs exactly that change, so a second tap or
   * a stale confirmation never toggles the group back.
   */
  private handlePassGroupConfirmAction = async (ctx: BotContext, clientUserProfile: UserProfileWithClient, pass: TClientPass) => {
    const [, confirmValue] = RegexHelper.getMatchGroupValue(ctx)
    const [groupIdValue, confirmedChange] = (confirmValue ?? '').split('-')
    const picked = await this.getPassGroupPick(ctx, pass, Number(groupIdValue))
    if (!picked) return

    const { group, change } = picked
    if (change !== confirmedChange) {
      if (change === 'last_group') {
        BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.PASS_GROUP.LAST_GROUP, { show_alert: true })
      } else {
        BotHelper.safeAnswerCbQuery(ctx)
      }
      return this.renderPassGroups(ctx, clientUserProfile, pass)
    }
    return this.applyPassGroupToggle(ctx, clientUserProfile, pass, group)
  }

  /** The group (an active one of this studio) and what a toggle would do to the pass now; null when refused (alert shown). */
  private async getPassGroupPick(ctx: BotContext, pass: TClientPass, groupId: number) {
    const refusal = this.getPassGroupsRefusal(ctx, pass)
    if (refusal) {
      BotHelper.safeAnswerCbQuery(ctx, refusal, { show_alert: true })
      return null
    }

    const groups = await this.groupService.getAllActiveGroups()
    const group = groups.find((g) => g.id === groupId)
    if (!group) {
      BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.PASS_GROUP.HINT, { show_alert: true })
      return null
    }

    const boundIds = PassSelectionHelper.getGroupIds(pass)
    const change: TPassGroupChange | 'last_group' = boundIds.includes(group.id)
      ? boundIds.length > 1
        ? 'remove'
        : 'last_group'
      : pass.passTemplate.multiGroup
        ? 'add'
        : 'replace'
    return { group, change }
  }

  private async isGroupForClientAge(clientUserProfile: UserProfileWithClient, groupId: number): Promise<boolean> {
    const ageGroups = await this.groupService.getAgeAppropriateActiveGroups(clientUserProfile.dateOfBirth ?? null)
    return ageGroups.some((g) => g.id === groupId)
  }

  /** Toggle the group, add an age exception for a new group outside the client's age, audit, toast, re-render the list. */
  private async applyPassGroupToggle(
    ctx: BotContext,
    clientUserProfile: UserProfileWithClient,
    pass: TClientPass,
    group: { id: number; name: string },
  ) {
    const [result, logOperations] = await this.passService.togglePassGroup(pass.id, group.id)
    if (result === 'last_group') {
      return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.PASS_GROUP.LAST_GROUP, { show_alert: true })
    }
    if (result === 'not_fixed' || result === 'unknown_group') {
      return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.PASS_GROUP.NOT_FIXED, { show_alert: true })
    }

    if (result !== 'removed' && !(await this.isGroupForClientAge(clientUserProfile, group.id))) {
      await this.groupAgeRestrictionService.addException(clientUserProfile.id, group.id)
    }

    AuditLogHelper.startAction(ctx, AuditLogActions.PASS_EDIT, AuditLogTrigger.ADMIN_ACTION, logOperations)
    const toast = { added: MESSAGES_SCENE.PASS_GROUP.ADDED, removed: MESSAGES_SCENE.PASS_GROUP.REMOVED, replaced: MESSAGES_SCENE.PASS_GROUP.REPLACED }
    BotHelper.safeAnswerCbQuery(ctx, toast[result](group.name))

    const updated = await this.passService.findStudioPassById(pass.id)
    return updated ? this.renderPassGroups(ctx, clientUserProfile, updated) : undefined
  }

  private renderPassGroups = async (ctx: BotContext, clientUserProfile: UserProfileWithClient, pass: TClientPass) => {
    const [groups, ageGroups] = await Promise.all([
      this.groupService.getAllActiveGroups(),
      this.groupService.getAgeAppropriateActiveGroups(clientUserProfile.dateOfBirth ?? null),
    ])
    const message = MESSAGES_SCENE.PASS_GROUP.CARD_LIST({
      fullName: UserHelper.getDisplayName(clientUserProfile),
      passName: pass.passTemplate.name,
      groupLine: PassHelper.getGroupLine(pass.passTemplate, PassSelectionHelper.getGroupNames(pass)),
      multiGroup: pass.passTemplate.multiGroup,
    })
    return BotHelper.safeEditMessageText(
      ctx,
      message,
      AdminKeyboards.passGroups(
        pass.id,
        groups,
        PassSelectionHelper.getGroupIds(pass),
        ageGroups.map((g) => g.id),
      ),
    )
  }

  private handleAddNewPassAction = async (ctx: BotContext, clientUserProfile: UserProfileWithClient) => {
    const originalPass = await this.passService.findActivePassByClientId(clientUserProfile.client.id, { withExpired: true })
    BotHelper.safeAnswerCbQuery(ctx)
    BotHelper.safeDeleteMessage(ctx)
    return ctx.scene.enter(SCENES.PASS_OPEN, { userProfile: clientUserProfile, originalPass })
  }

  private withClientIdAction = async (ctx: BotContext, action: (userProfile: UserProfileWithClient) => Promise<any>) => {
    const [clientUserId] = RegexHelper.getMatchGroupValue(ctx)

    if (!clientUserId) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка. Невірні дані кнопки.', { show_alert: true })
      BotHelper.safeDeleteMessage(ctx)
      return
    }

    const userProfile = await this.userProfileService.getUserProfileById(clientUserId)

    if (!userProfile || userProfile.client === null) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка. Користувач не є клієнтом.', { show_alert: true })
      BotHelper.safeDeleteMessage(ctx)
      return
    }

    return action(userProfile as UserProfileWithClient)
  }

  /** Actions on one pass: the pass (this studio's) comes from the callback, its client from the pass. */
  private withPassIdAction = async (
    ctx: BotContext,
    action: (userProfile: UserProfileWithClient, pass: TClientPass) => Promise<any>,
  ) => {
    const [passId] = RegexHelper.getMatchGroupValue(ctx)
    const pass = passId ? await this.passService.findStudioPassById(passId) : null

    if (!pass) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Абонемент не знайдено.', { show_alert: true })
      BotHelper.safeDeleteMessage(ctx)
      return
    }

    const clientUserProfile = await this.userProfileService.getUserProfileByClientId(pass.clientId)

    if (!clientUserProfile?.client) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка. Користувач не є клієнтом.', { show_alert: true })
      BotHelper.safeDeleteMessage(ctx)
      return
    }

    return action(clientUserProfile as UserProfileWithClient, pass)
  }
}
