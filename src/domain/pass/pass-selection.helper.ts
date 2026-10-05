import { addDays, format, parseISO } from 'date-fns'
import { PassSelectModel, PassTemplateSelectModel } from '@app/infrastructure/database'
import { PassGroupModeEnum, PassStatusEnum, PassTemplateTypeEnum } from '@app/libs'

/** The pass fields the selection rules need (a pass row with its template). Dates are `yyyy-MM-dd` (studio time zone). */
export type TSelectablePass = Pick<
  PassSelectModel,
  'id' | 'status' | 'availableSlots' | 'saleDate' | 'startDate' | 'endDate' | 'groupId' | 'groupMode'
> & { passTemplate: Pick<PassTemplateSelectModel, 'type' | 'durationDays'> }

/** A pass with what its label needs: template name, and the group name for a FIXED group pass. */
export type TLabelPass = TSelectablePass & {
  passTemplate: Pick<PassTemplateSelectModel, 'name'>
  group?: { name: string } | null
}

export type TPassTrainingRefusal = 'not_group' | 'not_active' | 'no_slots' | 'expired' | 'other_group'

/**
 * Which pass a group signup uses. A client may hold several active passes (another group, a renewal living next to
 * the old pass, a group pass next to an individual one). A pass that has not started yet starts on the day of the
 * signup action (owner, 2026-10-05), so it would be valid until today + duration.
 */
export class PassSelectionHelper {
  /** Last valid day: `end_date`, or today + duration for a pass that has not started yet. */
  static getEffectiveEndDate(pass: TSelectablePass, today: string): string {
    if (pass.startDate && pass.endDate) {
      return pass.endDate
    }
    return format(addDays(parseISO(today), pass.passTemplate.durationDays), 'yyyy-MM-dd')
  }

  static isStarted(pass: TSelectablePass): boolean {
    return !!pass.startDate && !!pass.endDate
  }

  /** FLEX works in any group, FIXED only in its own. */
  static coversGroup(pass: TSelectablePass, groupId: number): boolean {
    return pass.groupMode === PassGroupModeEnum.FLEX || pass.groupId === groupId
  }

  /** Why the pass can't pay for a training of `groupId` (null: any group) on `trainingDay`, or null when it can. */
  static getRefusal(pass: TSelectablePass, groupId: number | null, trainingDay: string, today: string): TPassTrainingRefusal | null {
    if (pass.passTemplate.type !== PassTemplateTypeEnum.GROUP) return 'not_group'
    if (pass.status !== PassStatusEnum.ACTIVE) return 'not_active'
    if (pass.availableSlots <= 0) return 'no_slots'
    if (trainingDay > this.getEffectiveEndDate(pass, today)) return 'expired'
    if (groupId !== null && !this.coversGroup(pass, groupId)) return 'other_group'
    return null
  }

  /** Group passes that can pay for a training of another group (admin picks one, with a warning). */
  static getValidIgnoringGroup<T extends TSelectablePass>(passes: T[], trainingDay: string, today: string): T[] {
    return this.sortByExpiry(
      passes.filter((pass) => this.getRefusal(pass, null, trainingDay, today) === null),
      today,
    )
  }

  /**
   * The pass a signup to a training of `groupId` on `trainingDay` uses, or null: FIXED passes of this group first
   * (FLEX is kept for other groups, owner), then FLEX; within each the one that ends first (a renewed pass's older
   * neighbour is used up first), passes that have not started yet last.
   */
  static pickForTraining<T extends TSelectablePass>(passes: T[], groupId: number, trainingDay: string, today: string): T | null {
    const valid = passes.filter((pass) => this.getRefusal(pass, groupId, trainingDay, today) === null)
    const fixed = valid.filter((pass) => pass.groupMode === PassGroupModeEnum.FIXED)
    const flex = valid.filter((pass) => pass.groupMode === PassGroupModeEnum.FLEX)
    return this.sortByExpiry(fixed, today)[0] ?? this.sortByExpiry(flex, today)[0] ?? null
  }

  /**
   * The pass the client works with: `currentPassId` while it is active and not past its end date, else the oldest
   * valid one (ends first; with free trainings before used-up ones), else null.
   */
  static getCurrentPass<T extends TSelectablePass>(passes: T[], currentPassId: string | null | undefined, today: string): T | null {
    const usable = passes.filter((pass) => pass.status === PassStatusEnum.ACTIVE && this.getEffectiveEndDate(pass, today) >= today)
    const current = usable.find((pass) => pass.id === currentPassId)
    if (current) return current

    const sorted = this.sortByExpiry(usable, today)
    return sorted.find((pass) => pass.availableSlots > 0) ?? sorted[0] ?? null
  }

  /** «STANDART · K-Pop» (до 20.10.2026); «Легкий старт · будь-яка група»; «INDIVIDUAL»; optionally with sessions left. */
  static getLabel(pass: TLabelPass, { withSlots = false } = {}): string {
    const isGroup = pass.passTemplate.type === PassTemplateTypeEnum.GROUP
    const scope = !isGroup ? '' : ` · ${pass.groupMode === PassGroupModeEnum.FLEX ? 'будь-яка група' : (pass.group?.name ?? '—')}`
    const slots = withSlots ? ` · залишок ${pass.availableSlots}` : ''
    const until = this.isStarted(pass) ? ` (до ${format(parseISO(pass.endDate!), 'dd.MM.yyyy')})` : ''
    return `«${pass.passTemplate.name}${scope}»${slots}${until}`
  }

  /** Started passes by end date, then not started ones by sale date. */
  static sortByExpiry<T extends TSelectablePass>(passes: T[], today: string): T[] {
    return [...passes].sort((a, b) => {
      const aStarted = this.isStarted(a)
      const bStarted = this.isStarted(b)
      if (aStarted !== bStarted) return aStarted ? -1 : 1
      const aKey = aStarted ? this.getEffectiveEndDate(a, today) : a.saleDate
      const bKey = bStarted ? this.getEffectiveEndDate(b, today) : b.saleDate
      return aKey.localeCompare(bKey)
    })
  }
}
