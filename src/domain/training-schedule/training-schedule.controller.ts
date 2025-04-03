import { Controller } from '@nestjs/common';
import { TrainingScheduleService } from './training-schedule.service';

@Controller('training-schedule')
export class TrainingScheduleController {
  constructor(private readonly trainingScheduleService: TrainingScheduleService) {}
}
