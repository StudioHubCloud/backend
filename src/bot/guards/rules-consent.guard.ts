import { BotContext } from '../bot.context'
import { UserHelper } from '../helpers'
import { CommonKeyboards } from '../modules/keyboard/storage'
import { RULES } from '../static/messages'

export const RulesConsentGuard = async (ctx: BotContext, next: () => Promise<void>) => {
  const {consentToRules} = UserHelper.getUser(ctx)

  if (consentToRules) {
    return await next()
  }

  return ctx.replyWithHTML(`💫 Дякуємо, що приєдналась до нас!\nПерш ніж розпочати, будь ласка, ознайомся з правилами студії та підтверди згоду на їх дотримання.\n\n` + RULES, CommonKeyboards.consentToRules())
}