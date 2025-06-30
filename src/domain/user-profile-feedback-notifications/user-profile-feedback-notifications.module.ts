import { DateTimeProvider } from '@app/infrastructure/providers';
import { APP } from '@app/libs';
import { Module } from '@nestjs/common'
import { UserProfileFeedbackNotificationService } from './user-profile-feedback-notifications.service';

@Module({
  imports: [],
  providers: [
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
    UserProfileFeedbackNotificationService
  ],
  exports: [UserProfileFeedbackNotificationService],
})
export class UserProfileFeedbackNotificationModule {}
