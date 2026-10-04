import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'
import { addDays } from 'date-fns'
import { BotContext } from '@app/bot/bot.context'
import { BotHelper, PersonalTrainingHelper, RegexHelper, UserHelper } from '@app/bot/helpers'
import { PersonalTrainingKeyboards } from '@app/bot/keyboard/storage'
import { CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { PersonalTrainingSignupService } from '@app/domain/personal-training-signup'
import { UserProfileService } from '@app/domain/user-profile'
import { PassService } from '@app/domain/pass'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'

/** "🤝 Заплановані індивідуальні" covers this many days ahead; the schedule covers the rest. */
const UPCOMING_DAYS = 14

/**
 * Individual sessions from the staff side: a trainer's upcoming sessions (trainer menu and "Персонал" → trainer),
 * and the admin-only actions in "Персонал" → trainer: register a one-off, cancel any of the trainer's sessions.
 */
@Injectable()
export class PersonalTrainingStaffComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    private readonly personalTrainingSignupService: PersonalTrainingSignupService,
    private readonly userProfileService: UserProfileService,
    private readonly passService: PassService,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    this.composer = new Composer<BotContext>()
    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initComposerHandlers() {
    // Trainer: own upcoming sessions
    this.composer.hears(BUTTON_PATTERNS.UPCOMING_PERSONAL_TRAININGS, async (ctx) => {
      const user = UserHelper.getUser(ctx)
      const message = await this.getUpcomingMessage(user.id)
      const parts = BotHelper.splitLongMessage(message ?? MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.NO_TRAINER)
      // A long list goes as several messages; "✖️ Закрити" on the last one
      for (const [index, part] of parts.entries()) {
        await ctx.replyWithHTML(part, index === parts.length - 1 ? PersonalTrainingKeyboards.closeOnly() : undefined)
      }
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PERSONAL_TRAINING.UPCOMING), async (ctx) => {
      return this.handleAdminStaffAction(ctx, async (staffUserId) => {
        const message = await this.getUpcomingMessage(staffUserId)

        if (!message) {
          return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.NO_TRAINER, { show_alert: true })
        }

        BotHelper.safeAnswerCbQuery(ctx)
        // A long list: the menu keeps the first part, the rest follows as new messages
        const [first, ...rest] = BotHelper.splitLongMessage(message)
        await BotHelper.safeEditMessageText(ctx, first, PersonalTrainingKeyboards.staffUpcomingMenu(staffUserId))
        for (const part of rest) {
          await BotHelper.safeSendMessage(ctx.telegram, ctx.chat!.id, part)
        }
      })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PERSONAL_TRAINING.ONE_OFF_REGISTER), async (ctx) => {
      return this.handleAdminStaffAction(ctx, async (staffUserId) => {
        BotHelper.safeAnswerCbQuery(ctx)
        BotHelper.safeDeleteMessage(ctx)
        return ctx.scene.enter(SCENES.ONE_OFF_TRAINING_REGISTER, { staffUserId })
      })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PERSONAL_TRAINING.STAFF_CANCEL_LIST), async (ctx) => {
      return this.handleAdminStaffAction(ctx, (staffUserId) => this.renderCancelList(ctx, staffUserId))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PERSONAL_TRAINING.STAFF_CANCEL_SELECT), async (ctx) => {
      return this.handleAdminStaffAction(ctx, (signupId) => this.handleCancel(ctx, signupId))
    })
  }

  /** Upcoming sessions message for a staff member's user profile, or null when they are not an active staff member. */
  private async getUpcomingMessage(staffUserId: string): Promise<string | null> {
    const staffUserProfile = await this.findStaffUserProfile(staffUserId)

    if (!staffUserProfile?.staffMember) {
      return null
    }

    const until = addDays(new Date(), UPCOMING_DAYS).toISOString()
    const sessions = await this.personalTrainingSignupService.getUpcomingForStaffMember(staffUserProfile.staffMember.id, until)
    return PersonalTrainingHelper.getStaffUpcomingMessage(
      UserHelper.getDisplayName(staffUserProfile),
      sessions,
      UPCOMING_DAYS,
      this.dateTimeProvider,
    )
  }

  private async renderCancelList(ctx: BotContext, staffUserId: string) {
    const staffUserProfile = await this.findStaffUserProfile(staffUserId)

    if (!staffUserProfile?.staffMember) {
      return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.NO_TRAINER, { show_alert: true })
    }

    const trainings = PersonalTrainingHelper.filterCancellable(
      ctx,
      await this.personalTrainingSignupService.getCancellableForStaffMember(staffUserProfile.staffMember.id),
    )

    if (!trainings.length) {
      return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.NO_TRAININGS_TO_CANCEL, { show_alert: true })
    }

    BotHelper.safeAnswerCbQuery(ctx)
    return BotHelper.safeEditMessageText(
      ctx,
      '🗑️ Оберіть індивідуальне заняття, яке потрібно скасувати:',
      PersonalTrainingKeyboards.staffCancelList(trainings, staffUserId, this.dateTimeProvider),
    )
  }

  private async handleCancel(ctx: BotContext, signupId: string) {
    const signup = await PersonalTrainingHelper.cancelByAdmin(
      ctx,
      signupId,
      { personalTrainingSignupService: this.personalTrainingSignupService, passService: this.passService },
      this.dateTimeProvider,
    )

    if (!signup) {
      return
    }

    const trainerUserProfile = signup.staffMember?.userProfile
    const remaining = signup.staffMember
      ? PersonalTrainingHelper.filterCancellable(ctx, await this.personalTrainingSignupService.getCancellableForStaffMember(signup.staffMember.id))
      : []

    if (!trainerUserProfile || !remaining.length) {
      return BotHelper.safeDeleteMessage(ctx)
    }

    return BotHelper.safeEditMessageText(
      ctx,
      '🗑️ Оберіть індивідуальне заняття, яке потрібно скасувати:',
      PersonalTrainingKeyboards.staffCancelList(remaining, trainerUserProfile.id, this.dateTimeProvider),
    )
  }

  private async findStaffUserProfile(staffUserId: string) {
    const staffUserProfiles = await this.userProfileService.getAllActiveStaffMembersUserProfiles()
    return staffUserProfiles.find((profile) => profile.id === staffUserId)
  }

  /** Admin-only callback with one id in the data (staff user profile id or signup id). */
  private async handleAdminStaffAction(ctx: BotContext, action: (id: string) => Promise<any>) {
    if (!UserHelper.isAdminRole(ctx)) {
      return BotHelper.safeAnswerCbQuery(ctx, '⛔️ Доступно лише адміністратору', { show_alert: true })
    }

    const [id] = RegexHelper.getMatchGroupValue(ctx)

    if (!id) {
      BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка. Невірні дані кнопки.', { show_alert: true })
      return BotHelper.safeDeleteMessage(ctx)
    }

    return action(id)
  }
}
