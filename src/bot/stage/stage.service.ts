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
    public readonly editPassScene: Stage.EditPassScene,
    public readonly editUserProfileScene: Stage.EditUserProfileScene,
    public readonly passPaymentScene: Stage.PassPaymentScene,
    public readonly specialScheduleScene: Stage.SpecialScheduleScene,
    public readonly passOpenScene: Stage.PassOpenScene,
    public readonly askAiScene: Stage.AskAiScene,
    public readonly personalTrainingRegisterScene: Stage.PersonalTrainingRegisterScene,
    public readonly oneOffTrainingRegisterScene: Stage.OneOffTrainingRegisterScene,
    public readonly personalTrainingNoteEditScene: Stage.PersonalTrainingNoteEditScene,
  ) {
    this.stage = new Scenes.Stage<BotContext>([
      registerScene,
      verifyClientScene,
      editPassScene,
      editUserProfileScene,
      passPaymentScene,
      specialScheduleScene,
      passOpenScene,
      askAiScene,
      personalTrainingRegisterScene,
      oneOffTrainingRegisterScene,
      personalTrainingNoteEditScene,
    ])
  }
}
