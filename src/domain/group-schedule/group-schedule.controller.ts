import { Controller } from '@nestjs/common';
import { GroupScheduleService } from './group-schedule.service';

@Controller('group-schedule')
export class GroupScheduleController {
  constructor(private readonly groupScheduleService: GroupScheduleService) {}
}
