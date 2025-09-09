import { Injectable } from '@nestjs/common'
import { Scenes } from 'telegraf'
import { BotContext } from '@app/bot/bot.context'
import * as Stage from './scenes'

@Injectable()
export class StageService {
  public readonly stage: Scenes.Stage<BotContext>

  constructor(
    public readonly registerScene: Stage.RegisterScene,
    public readonly verifyClientScene: Stage.VerifyClientScene,
    public readonly signInClientScene: Stage.SignInClientScene,
    public readonly initiatePayoutScene: Stage.InitiatePayoutScene,
    public readonly editPassScene: Stage.EditPassScene,
  ) {
    this.stage = new Scenes.Stage<BotContext>([
      registerScene,
      verifyClientScene,
      signInClientScene,
      initiatePayoutScene,
      editPassScene,
    ])
  }
}
