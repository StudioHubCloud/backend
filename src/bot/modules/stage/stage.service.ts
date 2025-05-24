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
    public readonly verifyTrainerScene: Stage.VerifyTrainerScene,
  ) {
    this.stage = new Scenes.Stage<BotContext>([registerScene, verifyClientScene, verifyTrainerScene])
  }
}
