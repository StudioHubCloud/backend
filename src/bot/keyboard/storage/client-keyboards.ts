import { InlineKeyboardButton } from '@telegraf/types'
import { KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { KEYBOARDS_CLIENT } from '@app/bot/static/keyboards'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { AuthUserProfile, CALLBACK_PREFIX, TParentMenu, TReplyInlineKeyboard, TReplyMarkupKeyboard } from '@app/bot/libs'
import { UserHelper } from '@app/bot/helpers'
import { MESSAGES_CLIENT } from '@app/bot/static/messages'
import { PassSelectionHelper, TLabelPass } from '@app/domain/pass'
import { COMMON_BUTTONS } from './common-keyboards'

export class ClientKeyboards {
  /**
   * `parent`: a parent (child approved or waiting) gets the profile button right under the signups row, showing whom the
   * screens act for: «👤 Профіль: Я» / «🧒 Профіль: Ліля».
   */
  static mainMenu({ parent = null }: { parent?: TParentMenu | null } = {}): TReplyMarkupKeyboard {
    const [signups, ...rest] = KEYBOARDS_CLIENT.MAIN_MENU
    const rows = parent ? [signups, [this.profileButtonLabel(parent.actingName)], ...rest] : KEYBOARDS_CLIENT.MAIN_MENU
    return KeyboardHelper.createReplyMarkupKeyboard(rows)
  }

  /** «✨ Більше» sub-menu: payment details, rules, register a child, «🔙 Назад до головного меню». */
  static more(): TReplyMarkupKeyboard {
    return KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_CLIENT.MORE_MENU)
  }

  /** "🎫 Інформація про абонемент" with several active passes: one per pass, the current one ✅ and green. */
  static passSwitch(passes: (TLabelPass & { id: string })[], currentPassId: string, { withRules = false } = {}): TReplyInlineKeyboard {
    const rows: InlineKeyboardButton[][] = passes.map((pass) => {
      const isCurrent = pass.id === currentPassId
      const button: InlineKeyboardButton = {
        text: `${isCurrent ? '✅ ' : ''}${PassSelectionHelper.getLabel(pass)}`,
        callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.CLIENT.PASS_SWITCH, pass.id),
      }
      return [isCurrent ? KeyboardHelper.withStyle(button, 'success') : button]
    })

    if (withRules) {
      rows.push([{ text: BUTTON_PATTERNS.INDIVIDUAL_PASS_RULES, callback_data: CALLBACK_PREFIX.CLIENT.PASS_RULES }])
    }
    rows.push([COMMON_BUTTONS.CLOSE]) // the client's pass card is a root menu

    return KeyboardHelper.createInlineKeyboard(rows)
  }

  static profileButtonLabel(actingName: string | null) {
    return actingName ? `${BUTTON_PATTERNS.PROFILE_CHILD_PREFIX}${actingName}` : BUTTON_PATTERNS.PROFILE_SELF
  }

  /** «🔄 За кого діємо?»: self + children (⏳ = waiting for the admin, not switchable), the current one ✅ and green. */
  static profiles(children: AuthUserProfile[], actingChildId: string | null): TReplyInlineKeyboard {
    const option = (label: string, value: string, isCurrent: boolean): InlineKeyboardButton[] => {
      const button: InlineKeyboardButton = {
        text: `${isCurrent ? '✅ ' : ''}${label}`,
        callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.CLIENT.CHILDREN.SWITCH, value),
      }
      return [isCurrent ? KeyboardHelper.withStyle(button, 'success') : button]
    }

    const rows = [option(`🙋 ${MESSAGES_CLIENT.CHILDREN_SELF}`, CHILDREN_SELF_VALUE, !actingChildId)]
    for (const child of children) {
      const icon = UserHelper.canActFor(child) ? '🧒' : '⏳'
      rows.push(option(`${icon} ${child.firstName}`, child.id, child.id === actingChildId))
    }
    rows.push([COMMON_BUTTONS.CLOSE]) // root menu

    return KeyboardHelper.createInlineKeyboard(rows)
  }
}

/** Switch value for "🙋 Я" (a profile id is a uuid, never this). */
export const CHILDREN_SELF_VALUE = 'self'
