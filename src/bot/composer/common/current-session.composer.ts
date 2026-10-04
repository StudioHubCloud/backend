import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'
import { BotContext } from '@app/bot/bot.context'
import { AuditLogHelper, BotHelper, CurrentSessionHelper, PersonalTrainingHelper, RegexHelper, UserHelper } from '@app/bot/helpers'
import type { TScheduleItem } from '@app/bot/helpers'
import { CurrentSessionKeyboards, ScheduleKeyboards } from '@app/bot/keyboard/storage'
import { FROM_CARD, NEW_MESSAGE } from '@app/bot/keyboard/storage/current-session-keyboards'
import { CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { PersonalTrainingSignupService } from '@app/domain/personal-training-signup'
import { TrainingService } from '@app/domain/training'
import { TrainingSignupService } from '@app/domain/training-signup'
import { UserProfileService } from '@app/domain/user-profile'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { AuditLogActions, AuditLogTrigger, PersonalTrainingSignupStatusEnum, TRAINING_CONFIG } from '@app/libs'

const PREFIX = CALLBACK_PREFIX.STAFF.CURRENT
const HOUR_MS = 60 * 60 * 1000
const LOOK_BACK_HOURS = 24 // ◀️ reaches yesterday evening's sessions (late confirmations)
const LOOK_AHEAD_DAYS = 7
const UNAVAILABLE_MESSAGE = '⚠️ Заняття недоступне: скасоване, не ваше або поза найближчими днями'
const REFUSED_MESSAGE = '⚠️ Не вдалося змінити: заняття скасоване або вже включене у виплату тренеру'

type TRenderMode = 'reply' | 'edit'

/**
 * "⏱ Поточне заняття" for trainers and admins: confirm who came to a group training (🔴 → 🟢 per person) or that an
 * individual session took place (✅ / 🚫). Trainers get their own sessions (substitutions included), admins the studio's.
 * The session list is also the permission check: a trainer can only reach and change items of their own list.
 * Which session opens: CurrentSessionHelper.pick, the same rule for both; the rest are a ◀️ / ▶️ away.
 */
@Injectable()
export class CurrentSessionComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    private readonly trainingService: TrainingService,
    private readonly trainingSignupService: TrainingSignupService,
    private readonly personalTrainingSignupService: PersonalTrainingSignupService,
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
    this.composer.hears(BUTTON_PATTERNS.CURRENT_SESSION, async (ctx) => {
      const items = await this.loadItems(ctx)
      const item = CurrentSessionHelper.pick(items)
      return item
        ? this.renderItem(ctx, items, CurrentSessionHelper.getItemKey(item), 'reply')
        : ctx.replyWithHTML(CurrentSessionHelper.getEmptyMessage(), CurrentSessionKeyboards.empty())
    })

    this.composer.action(RegexHelper.createButtonActionRegex(PREFIX.TRAINING), async (ctx) => {
      const [trainingId, mode] = RegexHelper.getMatchGroupValue(ctx)
      const training = trainingId ? await this.trainingService.getTrainingById(+trainingId) : null
      return this.openItem(ctx, `t${trainingId}`, training?.date, mode === NEW_MESSAGE ? 'reply' : 'edit')
    })

    this.composer.action(RegexHelper.createButtonActionRegex(PREFIX.SESSION), async (ctx) => {
      const [signupId, mode] = RegexHelper.getMatchGroupValue(ctx)
      const session = await this.findSession(signupId)
      return this.openItem(ctx, `s${signupId}`, session?.scheduledAt, mode === NEW_MESSAGE ? 'reply' : 'edit')
    })

    this.composer.action(RegexHelper.createButtonActionRegex(PREFIX.ATTENDANCE), async (ctx) => {
      const [signupId, flag] = RegexHelper.getMatchGroupValue(ctx)
      const [signup] = signupId && RegexHelper.isValidUuid(signupId)
        ? await this.trainingSignupService.findTrainingSignupsByCondition({ id: signupId })
        : []

      if (!signup) {
        return BotHelper.safeAnswerCbQuery(ctx, '⚠️ Запис не знайдено', { show_alert: true })
      }

      const anchor = (await this.trainingService.getTrainingById(signup.trainingId))?.date
      const items = await this.loadItems(ctx, anchor)
      const key = `t${signup.trainingId}`
      const item = items.find((candidate) => CurrentSessionHelper.getItemKey(candidate) === key)

      if (!item) {
        return BotHelper.safeAnswerCbQuery(ctx, UNAVAILABLE_MESSAGE, { show_alert: true })
      }
      if (!CurrentSessionHelper.canConfirmYet(item.start)) {
        return BotHelper.safeAnswerCbQuery(ctx, this.getTooEarlyMessage(), { show_alert: true })
      }

      const attended = flag === '1'
      try {
        const [, logOperations] = await this.trainingSignupService.setAttendance(signup.id, attended, UserHelper.getUser(ctx).id)
        AuditLogHelper.startAction(ctx, AuditLogActions.TRAINING_SIGNUP_ATTENDANCE, AuditLogTrigger.ADMIN_ACTION, logOperations)
      } catch {
        return BotHelper.safeAnswerCbQuery(ctx, REFUSED_MESSAGE, { show_alert: true })
      }

      BotHelper.safeAnswerCbQuery(ctx, attended ? '🟢 Присутність підтверджено' : '🔴 Відмітку знято')
      return this.renderItem(ctx, await this.loadItems(ctx, anchor), key, 'edit')
    })

    // Also tapped in the schedule's session card (code + FROM_CARD): that card is redrawn instead
    this.composer.action(RegexHelper.createButtonActionRegex(PREFIX.CONFIRM), async (ctx) => {
      const [signupId, rawCode] = RegexHelper.getMatchGroupValue(ctx)
      const fromCard = !!rawCode?.endsWith(FROM_CARD) && rawCode.length > 1
      const code = fromCard ? rawCode?.slice(0, -1) : rawCode
      const key = `s${signupId}`
      const anchor = (await this.findSession(signupId))?.scheduledAt
      const item = (await this.loadItems(ctx, anchor)).find((candidate) => CurrentSessionHelper.getItemKey(candidate) === key)

      if (!item?.session) {
        return BotHelper.safeAnswerCbQuery(ctx, UNAVAILABLE_MESSAGE, { show_alert: true })
      }
      if (!CurrentSessionHelper.canConfirmYet(item.start)) {
        return BotHelper.safeAnswerCbQuery(ctx, this.getTooEarlyMessage(), { show_alert: true })
      }

      try {
        const [, logOperations] =
          code === 'u'
            ? await this.personalTrainingSignupService.unconfirmTraining(item.session.id)
            : await this.personalTrainingSignupService.confirmTraining(
                item.session.id,
                code === 'n' ? PersonalTrainingSignupStatusEnum.NO_SHOW : PersonalTrainingSignupStatusEnum.COMPLETED,
                UserHelper.getUser(ctx).id,
              )
        AuditLogHelper.startAction(ctx, AuditLogActions.PERSONAL_TRAINING_CONFIRM, AuditLogTrigger.ADMIN_ACTION, logOperations)
      } catch {
        return BotHelper.safeAnswerCbQuery(ctx, REFUSED_MESSAGE, { show_alert: true })
      }

      BotHelper.safeAnswerCbQuery(ctx, code === 'u' ? '⏳ Очікує підтвердження' : code === 'n' ? '🚫 Неявка' : '✅ Відбулося')

      if (fromCard) {
        const session = await this.personalTrainingSignupService.findById(item.session.id)
        return session
          ? BotHelper.safeEditMessageText(
              ctx,
              PersonalTrainingHelper.getAdminSessionMessage(session, this.dateTimeProvider),
              ScheduleKeyboards.session(session, this.dateTimeProvider, {
                canManage: UserHelper.isAdminRole(ctx),
                canConfirm: true,
                isMaintainer: UserHelper.isMaintainerRole(ctx),
              }),
            )
          : undefined
      }
      return this.renderItem(ctx, await this.loadItems(ctx, anchor), key, 'edit')
    })

    // A one-time visitor (not a client) added on site: the scene creates the signup already confirmed
    this.composer.action(RegexHelper.createButtonActionRegex(PREFIX.ADD_VISITOR), async (ctx) => {
      const [trainingId] = RegexHelper.getMatchGroupValue(ctx)
      if (!UserHelper.isAdminRole(ctx)) {
        return BotHelper.safeAnswerCbQuery(ctx, '⛔️ Доступно лише адміністратору', { show_alert: true })
      }

      const training = trainingId ? await this.trainingService.getTrainingById(+trainingId) : null
      if (!training || training.isCancelled || training.staffMemberPayoutId) {
        return BotHelper.safeAnswerCbQuery(ctx, REFUSED_MESSAGE, { show_alert: true })
      }

      BotHelper.safeAnswerCbQuery(ctx)
      await BotHelper.safeDeleteMessage(ctx)
      return ctx.scene.enter(SCENES.SPECIAL_SCHEDULE, { trainingId: training.id, fromCurrentSession: true })
    })
  }

  private async openItem(ctx: BotContext, key: string, anchor: string | undefined, mode: TRenderMode) {
    const items = anchor ? await this.loadItems(ctx, anchor) : []
    if (!items.some((item) => CurrentSessionHelper.getItemKey(item) === key)) {
      return BotHelper.safeAnswerCbQuery(ctx, UNAVAILABLE_MESSAGE, { show_alert: true })
    }
    BotHelper.safeAnswerCbQuery(ctx)
    return this.renderItem(ctx, items, key, mode)
  }

  private async findSession(signupId: string | null) {
    return signupId && RegexHelper.isValidUuid(signupId) ? this.personalTrainingSignupService.findById(signupId) : null
  }

  private async renderItem(ctx: BotContext, items: TScheduleItem[], key: string, mode: TRenderMode) {
    const item = items.find((candidate) => CurrentSessionHelper.getItemKey(candidate) === key)
    if (!item) {
      return this.send(ctx, mode, CurrentSessionHelper.getEmptyMessage(), CurrentSessionKeyboards.empty())
    }

    const isAdmin = UserHelper.isAdminRole(ctx)
    const neighbours = CurrentSessionHelper.getNeighbours(items, key)

    if (item.training) {
      const signups = await this.trainingSignupService.getTrainingActiveSignups(item.training.id)
      return this.send(
        ctx,
        mode,
        CurrentSessionHelper.getTrainingMessage(item.training, signups, this.dateTimeProvider),
        CurrentSessionKeyboards.training(
          item.training.id,
          signups,
          neighbours,
          { isAdmin, isPaidOut: !!item.training.staffMemberPayoutId },
          this.dateTimeProvider,
        ),
      )
    }

    return this.send(
      ctx,
      mode,
      CurrentSessionHelper.getSessionMessage(item.session, this.dateTimeProvider),
      CurrentSessionKeyboards.session(item.session, neighbours, this.dateTimeProvider),
    )
  }

  private send(ctx: BotContext, mode: TRenderMode, message: string, keyboard: ReturnType<typeof CurrentSessionKeyboards.empty>) {
    return mode === 'reply' ? ctx.replyWithHTML(message, keyboard) : BotHelper.safeEditMessageText(ctx, message, keyboard)
  }

  /**
   * Not cancelled group trainings and individual sessions from LOOK_BACK_HOURS before now (or before `anchor`, a
   * session opened from the schedule or a training menu, maybe weeks ago) to LOOK_AHEAD_DAYS ahead, in time order:
   * the whole studio for admins, a trainer's own (group trainer or substitute; their individual sessions).
   */
  private async loadItems(ctx: BotContext, anchor?: string): Promise<TScheduleItem[]> {
    const now = Date.now()
    const anchorMs = anchor ? new Date(anchor).getTime() : now
    const from = new Date(Math.min(now, anchorMs) - LOOK_BACK_HOURS * HOUR_MS).toISOString()
    const to = new Date(Math.max(now, anchorMs) + LOOK_AHEAD_DAYS * 24 * HOUR_MS).toISOString()

    const [trainings, sessions] = await Promise.all([
      this.trainingService.getStudioTrainingsInRange(from, to),
      this.personalTrainingSignupService.getStudioScheduledInRange(from, to),
    ])

    let items: TScheduleItem[] = [
      ...trainings.filter((training) => !training.isCancelled).map((training) => ({ start: training.date, training })),
      ...sessions.map((session) => ({ start: session.scheduledAt, session })),
    ]

    if (!UserHelper.isAdminRole(ctx)) {
      const userProfile = await this.userProfileService.getUserProfileById(UserHelper.getUser(ctx).id)
      const ownStaffMemberId = userProfile?.staffMember?.id
      items = ownStaffMemberId
        ? items.filter((item) =>
            item.training
              ? CurrentSessionHelper.getTrainerStaffMemberId(item.training) === ownStaffMemberId
              : item.session.staffMemberId === ownStaffMemberId,
          )
        : []
    }

    return items.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  }

  private getTooEarlyMessage(): string {
    return `⏳ Відмітити можна за ${TRAINING_CONFIG.CONFIRM_LEAD_MINUTES} хв до початку`
  }
}
