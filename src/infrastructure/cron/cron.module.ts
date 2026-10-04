import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import {
  FeedbackNotificationModule,
  PassModule,
  UserProfileModule,
  TrainingModule,
  StaffMemberPayoutModule,
  PersonalTrainingSignupModule,
} from '@app/domain'
import { BotModule } from '@app/bot/bot.module';
import { DateTimeProvider } from '@app/infrastructure/providers'
import { APP } from '@app/libs'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TrainingModule,
    UserProfileModule,
    BotModule,
    PassModule,
    FeedbackNotificationModule,
    StaffMemberPayoutModule,
    PersonalTrainingSignupModule,
  ],
  providers: [
    CronService,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [CronService],
})
export class CronModule {}
