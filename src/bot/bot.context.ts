import { Context, Scenes, Telegram } from 'telegraf'
import { Update, UserFromGetMe } from '@telegraf/types'
import { TBotStore } from '@app/bot/libs'

export class BotContext extends Context {
  store: TBotStore
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
