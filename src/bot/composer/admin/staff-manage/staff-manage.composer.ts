import { Composer } from 'telegraf'
import { Inject, Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { BotHelper, RegexHelper, UserHelper } from '@app/bot/helpers'
import {
  GroupSelectPaginatedMenu,
  StaffSelectPaginatedMenu,
  REMOVE_GROUP_FROM_STAFF_MENU,
  ASSIGN_GROUP_TO_STAFF_MENU,
} from '@app/bot/menus'
import { CALLBACK_PREFIX, TPaginatedMenuRenderOptions } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { NextFunction } from 'express'
import { UserProfileService } from '@app/domain/user-profile'
import { AdminKeyboards } from '@app/bot/keyboard/storage'
import { GroupService } from '@app/domain/group'
import { API, UserProfileRoleEnum } from '@app/libs'

@Injectable()
export class StaffManageComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    private readonly staffSelectPaginatedMenu: StaffSelectPaginatedMenu,
    @Inject(ASSIGN_GROUP_TO_STAFF_MENU) private readonly groupSelectAddPaginatedMenu: GroupSelectPaginatedMenu,
    @Inject(REMOVE_GROUP_FROM_STAFF_MENU) private readonly groupSelectRemovePaginatedMenu: GroupSelectPaginatedMenu,
    private readonly userProfileService: UserProfileService,
    private readonly groupService: GroupService,
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
      this.staffSelectPaginatedMenu.middleware({
        callbackPrefix: CALLBACK_PREFIX.STAFF.MANAGE.LIST,
        promptMessage: '👤 Оберіть тренера зі списку:',
        noOptionsMessage: '👤 Немає доступних тренерів.',
        onItemSelect: this.renderStaffMemberManageMenu,
      }),
    )

    this.composer.use(
      this.groupSelectAddPaginatedMenu.middleware({
        callbackPrefix: CALLBACK_PREFIX.STAFF.MANAGE.ADD_GROUP_SELECT,
        promptMessage: '➕ Оберіть групу для призначення тренеру:',
        noOptionsMessage: '📋 Немає доступних груп для призначення',
        onItemSelect: this.handleAssignGroupToStaff,
      }),
    )

    this.composer.use(
      this.groupSelectRemovePaginatedMenu.middleware({
        callbackPrefix: CALLBACK_PREFIX.STAFF.MANAGE.REMOVE_GROUP_SELECT,
        promptMessage: '➖ Оберіть групу для видалення з тренера:',
        noOptionsMessage: '📋 У тренера немає призначених груп',
        onItemSelect: this.handleDeAssignGroupFromStaff,
      }),
    )
  }

  initComposerHandlers() {
    this.composer.hears(BUTTON_PATTERNS.STAFF, this.renderStaffSelectPaginatedMenu)

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.BACK_TO_STAFF_LIST), async (ctx) => {
      return this.renderStaffSelectPaginatedMenu(ctx, () => {}, { shouldEdit: true, withExitButton: true })
    })
    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.BACK_TO_STAFF_MANAGE), async (ctx) => {
      return this.renderStaffMemberManageMenu(ctx)
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.MANAGE.ADD_GROUP), async (ctx) => {
      return this.handleGroupManageAction(ctx, async (staffUserId) => {
        const availableGroups = await this.groupService.getAvailableGroupsToAssignToStaff()
        return this.renderGroupSelectMenu(ctx, staffUserId, availableGroups, API.GROUP_ACTION.ASSIGN)
      })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.MANAGE.REMOVE_GROUP), async (ctx) => {
      return this.handleGroupManageAction(ctx, async (staffUserId) => {
        const availableGroups = await this.groupService.getAvailableGroupsToDeAssignFromStaff(staffUserId)
        return this.renderGroupSelectMenu(ctx, staffUserId, availableGroups, API.GROUP_ACTION.DEASSIGN)
      })
    })
  }

  private renderStaffSelectPaginatedMenu = async (
    ctx: BotContext,
    _: NextFunction,
    renderOptions: TPaginatedMenuRenderOptions = { shouldEdit: false, withExitButton: true },
  ) => {
    return this.staffSelectPaginatedMenu.initMenu(ctx, {}, renderOptions)
  }

  private renderStaffMemberManageMenu = async (ctx: BotContext, staffUserId?: string) => {
    const userId = staffUserId ?? ctx['match']?.[1]
    const user = await this.userProfileService.getUserProfileById(userId)

    if (!user) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка при виборі тренера. Спробуйте ще раз.')
      ctx.deleteMessage()
      return
    }

    const isStaffMember = UserHelper.isStaffMember(user)

    if (!isStaffMember) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Обраний користувач не є тренером або адміністратором.')
      ctx.deleteMessage()
      return
    }

    BotHelper.safeAnswerCbQuery(ctx)

    return ctx.editMessageText(`👤 Обраний тренер: ${UserHelper.getDisplayName(user)}`, {
      parse_mode: 'HTML',
      ...AdminKeyboards.staffmemberManageMenu(user.id),
    })
  }

  private renderGroupSelectMenu = async (
    ctx: BotContext,
    staffUserId: string,
    availableGroups: any[],
    action: (typeof API.GROUP_ACTION)[keyof typeof API.GROUP_ACTION],
  ) => {
    const backButtonCallbackData = RegexHelper.createButtonActionCallbackData(
      CALLBACK_PREFIX.STAFF.PAYOUT.BACK_TO_STAFF_MANAGE,
      staffUserId,
    )

    const state = { userId: staffUserId, role: UserProfileRoleEnum.ADMIN, data: availableGroups }
    const renderOptions = { shouldEdit: true, backButtonCallbackData, context: { staffUserId } }

    if (action === API.GROUP_ACTION.ASSIGN) {
      return this.groupSelectAddPaginatedMenu.initMenu(ctx, state, renderOptions)
    } else if (action === API.GROUP_ACTION.DEASSIGN) {
      return this.groupSelectRemovePaginatedMenu.initMenu(ctx, state, renderOptions)
    }
  }

  private handleGroupManageAction = async (ctx: BotContext, callback: (staffUserId: string) => Promise<any>) => {
    const staffUserId = ctx['match']?.[1]

    if (!staffUserId) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️Відсутній ідентифікатор тренера. Спробуйте ще раз.')
      ctx.deleteMessage()
      return
    }

    return callback(staffUserId)
  }

  private handleAssignGroupToStaff = async (ctx: BotContext, groupId: string, context: Record<string, any>) => {
    const { staffUserId } = context

    if (!groupId || !staffUserId) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️Відсутній ідентифікатор групи або тренера. Спробуйте ще раз.', { show_alert: true })
      ctx.deleteMessage()
      return
    }

    const result = await this.groupService.manageGroupStaffMember(+groupId, staffUserId, API.GROUP_ACTION.ASSIGN)
    if (result) {
      BotHelper.safeAnswerCbQuery(ctx, '✅ Групу успішно призначено тренеру.', { show_alert: true })
    } else {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка при призначенні групи. Спробуйте ще раз.', { show_alert: true })
    }
    return this.renderStaffMemberManageMenu(ctx, staffUserId)
  }

  private handleDeAssignGroupFromStaff = async (ctx: BotContext, groupId: string, context: Record<string, any>) => {
    const { staffUserId } = context

    if (!groupId || !staffUserId) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️Відсутній ідентифікатор групи або тренера. Спробуйте ще раз.', { show_alert: true })
      ctx.deleteMessage()
      return
    }

    const result = await this.groupService.manageGroupStaffMember(+groupId, staffUserId, API.GROUP_ACTION.DEASSIGN)
    if (result) {
      BotHelper.safeAnswerCbQuery(ctx, '✅ Групу успішно знято з тренера.', { show_alert: true })
    } else {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка при знятті групи. Спробуйте ще раз.', { show_alert: true })
    }

    return this.renderStaffMemberManageMenu(ctx, staffUserId)
  }
}
