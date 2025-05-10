import { Context, Scenes, Telegram } from 'telegraf'
import { Update, UserFromGetMe } from 'telegraf/typings/core/types/typegram'
import { TBotStore } from '@app/libs'

interface MyWizardSession extends Scenes.WizardSessionData {
  myWizardSessionProp: number;
}

interface MySession extends Scenes.WizardSession<MyWizardSession> {
  mySessionProp: number;
}

export class BotContext extends Context {
  store: TBotStore
  scene: Scenes.SceneContextScene<BotContext, MyWizardSession>
  wizard: Scenes.WizardContextWizard<BotContext>
  session: MySession

  constructor(update: Update, api: Telegram, me: UserFromGetMe) {
    super(update, api, me)
    this.store = { user: null, studio: null }
  }
}
