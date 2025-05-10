import { Context, Scenes, Telegram } from 'telegraf'
import { Update, UserFromGetMe } from 'telegraf/typings/core/types/typegram'
import { TBotStore } from '@app/libs'

export class BotContext extends Context {
  store: TBotStore
  scene: Scenes.SceneContextScene<BotContext, Scenes.WizardSessionData>
  wizard: Scenes.WizardContextWizard<BotContext>

  constructor(update: Update, api: Telegram, me: UserFromGetMe) {
    super(update, api, me)
    this.store = { user: null, studio: null }
  }
}
