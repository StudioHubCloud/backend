import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { TrainingModule } from '@app/domain/training';
import { PassModule, UserProfileModule } from '@app/domain';
import { BotModule } from '@app/bot/bot.module';

@Module({
  imports: [ScheduleModule.forRoot(), TrainingModule, UserProfileModule, BotModule, PassModule],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
