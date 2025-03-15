import { TBotState } from '@app/libs/types/bot'
import { Api, Context } from 'grammy'
import { Update, UserFromGetMe } from 'grammy/types'

export class BotContext extends Context {
  public readonly state: TBotState

  constructor(update: Update, api: Api, me: UserFromGetMe) {
    super(update, api, me)
    this.state = { user: null, business: null }
  }
}
