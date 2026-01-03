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
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'

@Module({
  imports: [
    UserProfileModule,
    PassTemplateModule,
    TrainingSignupModule,
    GroupModule,
    StaffMemberPayoutModule,
    PassModule,
    TrainingModule,
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
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [StageService],
})
export class StageModule {}
