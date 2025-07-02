import { DateTimeProvider } from '@app/infrastructure/providers';
import { APP } from '@app/libs';
import { Module } from '@nestjs/common'
import { FeedbackNotificationService } from './feedback-notifications.service';

@Module({
  imports: [],
  providers: [
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
    FeedbackNotificationService
  ],
  exports: [FeedbackNotificationService],
})
export class FeedbackNotificationModule {}
