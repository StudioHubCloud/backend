import { TBotState } from '@app/libs/types/bot'
import { Context, Telegram } from 'telegraf'
import { Update, UserFromGetMe } from 'telegraf/typings/core/types/typegram'

export class BotContext extends Context {
  public readonly state: TBotState

  constructor(update: Update, api: Telegram, me: UserFromGetMe) {
    super(update, api, me)
    this.state = { user: false, business: true }
  }
}
