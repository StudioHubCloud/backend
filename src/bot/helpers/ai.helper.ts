import { AiActor } from '@app/infrastructure/ai'
import { BotContext } from '../bot.context'
import { UserHelper } from './user.helper'

const ALLOWED_TAG_REGEX = /<\/?(b|i|u)>/gi

export class AiHelper {
  // Every AiAssistantService call site needs both the actor and the conversationId together —
  // one function so callers can't derive them inconsistently across composers/scenes.
  static getActorContext(ctx: BotContext): { actor: AiActor; conversationId: string } {
    const user = UserHelper.getUser(ctx)

    return {
      actor: { id: user.id, role: user.role, name: user.fullName, dateOfBirth: user.dateOfBirth },
      conversationId: `${user.id}:${ctx.chat?.id}`,
    }
  }

  // The model is instructed to only use <b>/<i>/<u>, but instructions aren't a guarantee — an
  // unclosed or mismatched tag makes Telegram reject the whole message with a 400 ("can't parse
  // entities"), which (upstream of this call) surfaces as a generic error and boots the admin out
  // of the scene. This makes that failure mode structurally impossible: any stray "<"/">" outside
  // an allowed tag is escaped to literal text, and if the allowed tags themselves don't balance,
  // all of them are stripped — worst case is a plain-text reply, never a rejected one.
  static sanitizeReplyHtml(text: string): string {
    let escaped = ''
    let lastIndex = 0

    const normalized = AiHelper.normalizeMarkdown(text)

    for (const match of normalized.matchAll(ALLOWED_TAG_REGEX)) {
      const tag = match[0]
      const index = match.index as number
      escaped += AiHelper.escapeStrayAngleBrackets(normalized.slice(lastIndex, index)) + tag
      lastIndex = index + tag.length
    }
    escaped += AiHelper.escapeStrayAngleBrackets(normalized.slice(lastIndex))

    return AiHelper.tagsAreBalanced(escaped) ? escaped : escaped.replace(ALLOWED_TAG_REGEX, '')
  }

  // The model is told not to use markdown, but still reaches for it sometimes (it's the more
  // "natural" way for it to express emphasis). Rather than relying on that instruction holding
  // perfectly, translate the markdown it actually sends into the HTML tags Telegram renders —
  // so a stray **bold** shows up bold instead of as literal asterisks in the chat.
  private static normalizeMarkdown(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''))
      .replace(/`([^`\n]+)`/g, '$1')
      .replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*\*([^*\n]+)\*\*\*/g, '<b><i>$1</i></b>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<i>$1</i>')
  }

  private static escapeStrayAngleBrackets(segment: string): string {
    return segment.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  private static tagsAreBalanced(text: string): boolean {
    const stack: string[] = []

    for (const match of text.matchAll(ALLOWED_TAG_REGEX)) {
      const tag = match[0]
      const name = tag.replace(/[</>]/g, '').toLowerCase()

      if (tag.startsWith('</')) {
        if (stack.pop() !== name) {
          return false
        }
      } else {
        stack.push(name)
      }
    }

    return stack.length === 0
  }
}
