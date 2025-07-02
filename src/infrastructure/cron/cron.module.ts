import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { FeedbackNotificationModule, PassModule, UserProfileModule, TrainingModule } from '@app/domain';
import { BotModule } from '@app/bot/bot.module';

@Module({
  imports: [ScheduleModule.forRoot(), TrainingModule, UserProfileModule, BotModule, PassModule, FeedbackNotificationModule],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
