import { Module } from '@nestjs/common'
import { StageService } from './stage.service'
import * as Stage from './scenes'
import {
  GroupModule,
  PassModule,
  PassTemplateModule,
  StaffMemberPayoutModule,
  TrainingModule,
  TrainingSignupModule,
  UserProfileModule,
} from '@app/domain'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { AiModule } from '@app/infrastructure/ai'
import { AudioTranscribeModule } from '@app/infrastructure/audio-transcribe'
import { APP } from '@app/libs'

@Module({
  imports: [
    UserProfileModule,
    PassTemplateModule,
    TrainingSignupModule,
    GroupModule,
    StaffMemberPayoutModule,
    PassModule,
    TrainingModule,
    AiModule,
    AudioTranscribeModule,
  ],
  providers: [
    StageService,
    Stage.RegisterScene,
    Stage.VerifyClientScene,
    Stage.InitiatePayoutScene,
    Stage.EditPassScene,
    Stage.EditUserProfileScene,
    Stage.PassPaymentScene,
    Stage.SpecialScheduleScene,
    Stage.PassOpenScene,
    Stage.AskAiScene,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [StageService],
})
export class StageModule {}
