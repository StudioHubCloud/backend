import { Telegram } from 'telegraf'
import { UserProfileService } from '@app/domain/user-profile'
import { AI_RISK_TIER, AiToolDefinition } from '../ai.types'

// Same standalone-client approach as notify-maintainer.tool.ts — see that file for why this
// doesn't go through BOT_INSTANCE/BotNotificationService.
export function buildNotifyAdminTool(deps: { botToken: string; userProfileService: UserProfileService }): AiToolDefinition {
  const { botToken, userProfileService } = deps
  const telegram = new Telegram(botToken)

  return {
    name: 'notify_admin',
    description:
      "Send a message to the studio's admins on behalf of the person you're talking to. Use this when they explicitly want to reach an admin directly — a special request, a complaint, something you can't resolve yourself, or anything else they ask you to pass along. Confirm back to them that their message was sent. Write the message itself in Ukrainian, and mention who it's from.",
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The message to pass along to the studio admins, in Ukrainian.' },
      },
      required: ['message'],
      additionalProperties: false,
    },
    // Not CRITICAL: the person asked for this explicitly, so a second confirmation step before
    // sending would just be redundant friction, same reasoning as notify_maintainer.
    riskTier: AI_RISK_TIER.STANDARD,
    execute: async (actor, input: { message: string }) => {
      const admins = await userProfileService.findStudioAdmins()
      const text = `📩 Повідомлення від клієнта (actor ${actor.id}, role: ${actor.role}) через AI-асистента:\n${input.message}`

      await Promise.all(admins.map((admin) => telegram.sendMessage(admin.telegramId, text)))

      return { result: { notified: true, adminCount: admins.length } }
    },
  }
}
