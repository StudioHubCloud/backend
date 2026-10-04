import { BotContext } from '../bot.context'
import { PassHelper, UserHelper } from '../helpers'
import { CommonKeyboards } from '../keyboard/storage'

export const RulesConsentGuard = async (ctx: BotContext, next: () => Promise<void>) => {
  const {consentToRules} = UserHelper.getUser(ctx)

  if (consentToRules) {
    return await next()
  }

  return ctx.replyWithHTML(`💫 Дякуємо, що приєдналась до нас!\nПерш ніж розпочати, будь ласка, ознайомся з правилами студії та підтверди згоду на їх дотримання.\n\n` + PassHelper.getRulesMessage(), CommonKeyboards.consentToRules())
}