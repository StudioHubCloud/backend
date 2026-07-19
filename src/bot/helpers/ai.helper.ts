import { AiActor } from '@app/infrastructure/ai'
import { BotContext } from '../bot.context'
import { UserHelper } from './user.helper'

export class AiHelper {
  // Every AiAssistantService call site needs both the actor and the conversationId together —
  // one function so callers can't derive them inconsistently across composers/scenes.
  static getActorContext(ctx: BotContext): { actor: AiActor; conversationId: string } {
    const user = UserHelper.getUser(ctx)

    return {
      actor: { id: user.id, role: user.role },
      conversationId: `${user.id}:${ctx.chat?.id}`,
    }
  }
}
