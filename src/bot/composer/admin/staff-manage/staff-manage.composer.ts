import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { RegexHelper, UserHelper } from '@app/bot/helpers'
import { StaffSelectPaginatedMenu } from '@app/bot/menus'
import { CALLBACK_PREFIX } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { NextFunction } from 'express'
import { UserProfileService } from '@app/domain/user-profile'
import { AdminKeyboards } from '@app/bot/keyboard/storage'

@Injectable()
export class StaffManageComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    private readonly staffSelectPaginatedMenu: StaffSelectPaginatedMenu,
    private readonly userProfileService: UserProfileService,
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
  }

  initComposerHandlers() {
    this.composer.hears(BUTTON_PATTERNS.STAFF, this.renderStaffSelectPaginatedMenu)

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.BACK_TO_STAFF_LIST), async (ctx) => {
      return this.renderStaffSelectPaginatedMenu(ctx, () => {}, true)
    })
    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.BACK_TO_STAFF_MANAGE), async (ctx) => {
      return this.renderStaffMemberManageMenu(ctx)
    })
  }

  private renderStaffSelectPaginatedMenu = async (ctx: BotContext, _: NextFunction, shouldEdit = false) => {
    return this.staffSelectPaginatedMenu.initMenu(ctx, {}, { shouldEdit })
  }

  private renderStaffMemberManageMenu = async (ctx: BotContext) => {
    const userId = ctx['match']?.[1]

    const user = await this.userProfileService.getUserProfileById(userId)

    if (!user) {
      ctx.answerCbQuery('❗️ Помилка при виборі тренера. Спробуйте ще раз.')
      ctx.deleteMessage()
      return
    }

    const isStaffMember = UserHelper.isStaffMember(user)

    if (!isStaffMember) {
      ctx.answerCbQuery('❗️ Обраний користувач не є тренером або адміністратором.')
      ctx.deleteMessage()
      return
    }

    return ctx.editMessageText(`👤 Обраний тренер: ${UserHelper.getFullName(user.firstName, user.lastName)}`, {
      parse_mode: 'HTML',
      ...AdminKeyboards.staffmemberManageMenu(user.id),
    })
  }
}
