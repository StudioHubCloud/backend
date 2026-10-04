import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'
import { format, parse } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { BotContext } from '@app/bot/bot.context'
import { BotHelper, PersonalTrainingHelper, RegexHelper, ScheduleHelper, UserHelper } from '@app/bot/helpers'
import { AdminKeyboards, ScheduleKeyboards } from '@app/bot/keyboard/storage'
import { CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { CalendarPicker, TCalendarPickerOptions } from '@app/bot/menus'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { GroupService } from '@app/domain/group'
import { PassService } from '@app/domain/pass'
import { PersonalTrainingSignupService } from '@app/domain/personal-training-signup'
import { TrainingService } from '@app/domain/training'
import { UserProfileService } from '@app/domain/user-profile'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { DATE_FORMAT } from '@app/libs'

const PREFIX = CALLBACK_PREFIX.STAFF.SCHEDULE
const CALENDAR_PROMPT = '📅 <b>Розклад студії</b>\n\nОберіть день'

/**
 * "📅 Розклад студії" for admins and trainers: a day's timeline (group trainings and individual sessions, ◀️ / ▶️ by day,
 * "📅 Обрати дату" for the calendar) → the existing group menu (with "Назад до дня") or one individual session.
 * A shortcut to "Групи" with the same limits: a trainer opens only their own groups, and individual sessions are
 * read-only for trainers (admins can edit a one-off's note and cancel). Dates travel as yyyy-MM-dd in the studio time zone.
 */
@Injectable()
export class StudioScheduleComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    private readonly trainingService: TrainingService,
    private readonly groupService: GroupService,
    private readonly personalTrainingSignupService: PersonalTrainingSignupService,
    private readonly passService: PassService,
    private readonly userProfileService: UserProfileService,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    this.composer = new Composer<BotContext>()
    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initComposerHandlers() {
    // Opens on today's timeline; the calendar ("📅 Обрати дату") is only for jumping to a date
    this.composer.hears(BUTTON_PATTERNS.STUDIO_SCHEDULE, async (ctx) => {
      const { message, keyboard } = await this.buildDay(this.getToday())
      return ctx.replyWithHTML(message, keyboard)
    })

    // Calendar callbacks outside scenes (scenes handle their own pickers before composers)
    this.composer.action(new RegExp(`^${CALLBACK_PREFIX.PICKER.CALENDAR.NAV}|^${CALLBACK_PREFIX.PICKER.CALENDAR.DAY}|^${CALLBACK_PREFIX.PICKER.CALENDAR.NOOP}`), async (ctx) => {
      const picked = await CalendarPicker.handle(ctx, this.getToday(), this.getCalendarOptions())
      if (picked?.type !== 'selected') {
        return
      }
      return this.renderDay(ctx, format(parse(picked.date, DATE_FORMAT.DATE_INPUT, new Date()), DATE_FORMAT.DATE_MAIN))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(PREFIX.CALENDAR), async (ctx) => {
      const [month] = RegexHelper.getMatchGroupValue(ctx)
      BotHelper.safeAnswerCbQuery(ctx)
      return BotHelper.safeEditMessageText(
        ctx,
        CALENDAR_PROMPT,
        await CalendarPicker.keyboard(this.getToday(), this.getCalendarOptions(), month ?? undefined),
      )
    })

    this.composer.action(RegexHelper.createButtonActionRegex(PREFIX.DAY), async (ctx) => {
      const [date] = RegexHelper.getMatchGroupValue(ctx)
      return date ? this.renderDay(ctx, date) : BotHelper.safeAnswerCbQuery(ctx)
    })

    this.composer.action(RegexHelper.createButtonActionRegex(PREFIX.GROUP), async (ctx) => {
      const [groupId, date] = RegexHelper.getMatchGroupValue(ctx)
      if (!groupId || !date) {
        return BotHelper.safeAnswerCbQuery(ctx)
      }
      const group = await this.groupService.getGroupById(+groupId)

      if (!UserHelper.isAdminRole(ctx) && group.staffMemberId !== (await this.getOwnStaffMemberId(ctx))) {
        return BotHelper.safeAnswerCbQuery(ctx, '👀 Це не ваша група: доступний лише перегляд розкладу', { show_alert: true })
      }

      BotHelper.safeAnswerCbQuery(ctx)
      // The regular group menu and flow (trainings → training, with each role's buttons); the schedule origin
      // travels through it, so every "Назад" in it leads back to this day
      const origin = ScheduleKeyboards.toOrigin(date)
      return BotHelper.safeEditMessageText(
        ctx,
        MessageHelper.constructGroupSelectMessage(group),
        AdminKeyboards.groupManageMenu(+groupId, origin, ScheduleKeyboards.backButtonForOrigin(origin)),
      )
    })

    this.composer.action(RegexHelper.createButtonActionRegex(PREFIX.PERSONAL), async (ctx) => {
      const [signupId] = RegexHelper.getMatchGroupValue(ctx)
      return signupId ? this.renderSession(ctx, signupId) : BotHelper.safeAnswerCbQuery(ctx)
    })

    this.composer.action(RegexHelper.createButtonActionRegex(PREFIX.PERSONAL_CANCEL), async (ctx) => {
      const [signupId] = RegexHelper.getMatchGroupValue(ctx)
      if (!signupId || !UserHelper.isAdminRole(ctx)) {
        return BotHelper.safeAnswerCbQuery(ctx, '⛔️ Доступно лише адміністратору', { show_alert: true })
      }
      const signup = await PersonalTrainingHelper.cancelByAdmin(
        ctx,
        signupId,
        { personalTrainingSignupService: this.personalTrainingSignupService, passService: this.passService },
        this.dateTimeProvider,
      )
      if (!signup) {
        return
      }
      return this.renderDay(ctx, this.dateTimeProvider.formatDateStringInTz(signup.scheduledAt, DATE_FORMAT.DATE_MAIN))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(PREFIX.PERSONAL_NOTE), async (ctx) => {
      const [signupId] = RegexHelper.getMatchGroupValue(ctx)
      if (!signupId || !UserHelper.isAdminRole(ctx)) {
        return BotHelper.safeAnswerCbQuery(ctx, '⛔️ Доступно лише адміністратору', { show_alert: true })
      }
      BotHelper.safeAnswerCbQuery(ctx)
      BotHelper.safeDeleteMessage(ctx)
      return ctx.scene.enter(SCENES.PERSONAL_TRAINING_NOTE_EDIT, { signupId })
    })
  }

  private async renderDay(ctx: BotContext, date: string) {
    const { message, keyboard } = await this.buildDay(date)
    BotHelper.safeAnswerCbQuery(ctx)
    return BotHelper.safeEditMessageText(ctx, message, keyboard)
  }

  /** The day's group trainings and individual sessions as one timeline, with a button per item. */
  private async buildDay(date: string) {
    const [from, to] = this.getDayRange(date, date)
    const [trainings, sessions] = await Promise.all([
      this.trainingService.getStudioTrainingsInRange(from, to),
      this.personalTrainingSignupService.getStudioScheduledInRange(from, to),
    ])
    const { items, hiddenCount } = ScheduleHelper.getItems(trainings, sessions)

    return {
      message: ScheduleHelper.getDayMessage(date, items, hiddenCount, this.dateTimeProvider),
      keyboard: ScheduleKeyboards.day(date, items, this.dateTimeProvider),
    }
  }

  private async renderSession(ctx: BotContext, signupId: string) {
    const session = await this.personalTrainingSignupService.findById(signupId)

    if (!session) {
      BotHelper.safeAnswerCbQuery(ctx, '⚠️ Заняття не знайдено', { show_alert: true })
      return BotHelper.safeDeleteMessage(ctx)
    }

    BotHelper.safeAnswerCbQuery(ctx)
    return BotHelper.safeEditMessageText(
      ctx,
      PersonalTrainingHelper.getAdminSessionMessage(session, this.dateTimeProvider),
      ScheduleKeyboards.session(session, this.dateTimeProvider, UserHelper.isAdminRole(ctx)),
    )
  }

  /** The trainer's own staff member id (the session user doesn't carry it). */
  private async getOwnStaffMemberId(ctx: BotContext): Promise<string | undefined> {
    const userProfile = await this.userProfileService.getUserProfileById(UserHelper.getUser(ctx).id)
    return userProfile?.staffMember?.id
  }

  /** Plain date jump: day colours weren't informative (nearly every day has a group training). */
  private getCalendarOptions(): TCalendarPickerOptions {
    return { withCloseButton: true } // root menu
  }

  /** UTC range of whole studio-local days (yyyy-MM-dd). */
  private getDayRange(firstDay: string, lastDay: string): [string, string] {
    const timeZone = this.dateTimeProvider.time_zone
    return [
      fromZonedTime(`${firstDay}T00:00:00`, timeZone).toISOString(),
      fromZonedTime(`${lastDay}T23:59:59.999`, timeZone).toISOString(),
    ]
  }

  private getToday() {
    return this.dateTimeProvider.getTodayDateStringInTz(DATE_FORMAT.DATE_MAIN)
  }
}
