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
    public readonly initiatePayoutScene: Stage.InitiatePayoutScene,
    public readonly editPassScene: Stage.EditPassScene,
    public readonly editUserProfileScene: Stage.EditUserProfileScene,
    public readonly passPurchaseScene: Stage.PassPurchaseScene,
    public readonly passRenewScene: Stage.PassRenewScene,
    public readonly specialScheduleScene: Stage.SpecialScheduleScene,
  ) {
    this.stage = new Scenes.Stage<BotContext>([
      registerScene,
      verifyClientScene,
      initiatePayoutScene,
      editPassScene,
      editUserProfileScene,
      passPurchaseScene,
      passRenewScene,
      specialScheduleScene,
    ])
  }
}
