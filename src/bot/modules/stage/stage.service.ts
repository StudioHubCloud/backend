import { Injectable } from '@nestjs/common'
import { Scenes } from 'telegraf'
import { BotContext } from '@app/bot/bot.context'
import * as Stage from './scenes'

@Injectable()
export class StageService {
  public readonly stage: Scenes.Stage<BotContext>

  constructor(private readonly verificationRequestScene: Stage.VerificationRequestScene) {
    this.stage = new Scenes.Stage<BotContext>([verificationRequestScene])
  }
}
