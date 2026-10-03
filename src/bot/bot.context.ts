import { Context, Scenes, Telegram } from 'telegraf'
import { Update, UserFromGetMe } from '@telegraf/types'
import { TBotSession, TBotStore } from '@app/bot/libs'

export class BotContext extends Context {
  store: TBotStore
  // `declare`: type only — telegraf's session() middleware defines this property at runtime
  declare session: TBotSession
  scene: Scenes.SceneContextScene<BotContext, Scenes.WizardSessionData>
  wizard: Scenes.WizardContextWizard<BotContext>

  constructor(update: Update, api: Telegram, me: UserFromGetMe) {
    super(update, api, me)
    this.store = {
      user: null,
      audit: null,
    }
  }
}
