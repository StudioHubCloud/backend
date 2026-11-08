import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'
import { BotContext } from '@app/bot/bot.context'
import { BotHelper, KeyboardHelper, RegexHelper, TextHelper, UserHelper } from '@app/bot/helpers'
import { CHILDREN_SELF_VALUE, ClientKeyboards } from '@app/bot/keyboard/storage'
import { CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { MESSAGES_CLIENT } from '@app/bot/static/messages'
import { UserProfileService } from '@app/domain/user-profile'
import { UserProfileStatusEnum } from '@app/libs'

/** The main-menu profile button: «👤 Профіль: Я» / «🧒 Профіль: <ім'я>» (+ the legacy «👨‍👩‍👧 Мої діти» of old keyboards). */
const PROFILE_BUTTON = new RegExp(
  `^(${[BUTTON_PATTERNS.PROFILE_SELF, BUTTON_PATTERNS.MY_CHILDREN].map(RegexHelper.escape).join('|')}|${RegexHelper.escape(BUTTON_PATTERNS.PROFILE_CHILD_PREFIX)}.+)$`,
)

/**
 * Profile switcher of a parent («🔄 За кого діємо?»): the client screens act for self or a child. The parent always comes
 * from the session; registering a child lives in «✨ Більше».
 */
@Injectable()
export class ChildrenComposer {
  private readonly composer: Composer<BotContext>

  constructor(private readonly userProfileService: UserProfileService) {
    this.composer = new Composer<BotContext>()
    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  private initComposerHandlers() {
    this.composer.hears(PROFILE_BUTTON, this.renderProfiles)
    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.CLIENT.CHILDREN.SWITCH), this.switchHandler)
    // «➕» of old profile lists (before 2026-11-08)
    this.composer.action(CALLBACK_PREFIX.CLIENT.CHILDREN.ADD, this.addChildHandler)
    // «✨ Більше» → «👧 Зареєструвати дитину» (the same label on the start screen is handled by GuardComposer)
    this.composer.hears(BUTTON_PATTERNS.REGISTER_AS_PARENT, (ctx) => ctx.scene.enter(SCENES.REGISTER_CHILD, { withParent: false }))
  }

  /** Approved children and the ones waiting for the admin (rejected / archived ones are hidden). */
  private async getChildren(ctx: BotContext) {
    const children = await this.userProfileService.findChildren(UserHelper.getUser(ctx).id)
    return children.filter(
      (child) => child.status === UserProfileStatusEnum.ACTIVE || child.status === UserProfileStatusEnum.VERIFICATION_REQUESTED,
    )
  }

  private renderProfiles = async (ctx: BotContext) => {
    const children = await this.getChildren(ctx)
    if (!children.length) {
      return ctx.replyWithHTML(MESSAGES_CLIENT.PROFILE_ONLY_SELF)
    }
    const actingChildId = UserHelper.isActingForChild(ctx) ? UserHelper.getActingUser(ctx).id : null
    return ctx.replyWithHTML(MESSAGES_CLIENT.PROFILE_CHOOSE, ClientKeyboards.profiles(children, actingChildId))
  }

  /**
   * The child id from the button is checked against the parent in the session (own child, this studio, approved). After a
   * switch the list goes away and the main menu comes again: its profile button shows the new profile.
   */
  private switchHandler = async (ctx: BotContext) => {
    const parent = UserHelper.getUser(ctx)
    const [value] = RegexHelper.getMatchGroupValue(ctx)

    if (value === CHILDREN_SELF_VALUE) {
      await this.userProfileService.setActingProfile(parent.id, null)
      UserHelper.setActingUser(ctx, null)
      return this.confirmSwitch(ctx, `${BUTTON_PATTERNS.PROFILE_SELF}`)
    }

    const child = value ? await this.userProfileService.findChildOfGuardian(parent.id, value) : null
    if (!child) {
      return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_CLIENT.CHILDREN_GONE, { show_alert: true })
    }
    if (!UserHelper.canActFor(child)) {
      return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_CLIENT.CHILDREN_PENDING, { show_alert: true })
    }

    await this.userProfileService.setActingProfile(parent.id, child.id)
    UserHelper.setActingUser(ctx, child)
    return this.confirmSwitch(ctx, ClientKeyboards.profileButtonLabel(child.firstName))
  }

  private async confirmSwitch(ctx: BotContext, profileLabel: string) {
    await BotHelper.safeAnswerCbQuery(ctx)
    await BotHelper.safeDeleteMessage(ctx)
    return ctx.replyWithHTML(
      `${TextHelper.bold(TextHelper.escapeHtml(profileLabel))}\n${MESSAGES_CLIENT.PROFILE_SWITCHED}`,
      KeyboardHelper.getMainMenuKeyboard(ctx),
    )
  }

  /** «➕ Зареєструвати дитину» of an old list: the parent is already a client; the scene re-checks it. */
  private addChildHandler = async (ctx: BotContext) => {
    await BotHelper.safeAnswerCbQuery(ctx)
    return ctx.scene.enter(SCENES.REGISTER_CHILD, { withParent: false })
  }
}
