import { BotContext } from '../bot.context'
import { UserHelper } from '../helpers'
import { CommonKeyboards } from '../modules/keyboard/storage'
import { RULES } from '../static/messages'

export const RulesConsentGuard = async (ctx: BotContext, next: () => Promise<void>) => {
  const {consentToRules} = UserHelper.getUser(ctx)

  if (consentToRules) {
    return await next()
  }

  return ctx.replyWithHTML(`💫 <b>Дякуємо, що приєднались!</b>\n\n<i>Перш ніж продовжити, будь ласка, ознайомся з <b>правилами студії</b> та підтверди свою згоду на їх дотримання.</i>\n\n` + RULES, CommonKeyboards.consentToRules())
}