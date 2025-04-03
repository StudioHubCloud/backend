import { Module } from '@nestjs/common';
import { TrainingScheduleService } from './training-schedule.service';
import { TrainingScheduleController } from './training-schedule.controller';

@Module({
  controllers: [TrainingScheduleController],
  providers: [TrainingScheduleService],
})
export class TrainingScheduleModule {}
