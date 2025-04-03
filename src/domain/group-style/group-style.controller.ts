import { Controller } from '@nestjs/common';
import { GroupStyleService } from './group-style.service';

@Controller('group-style')
export class GroupStyleController {
  constructor(private readonly groupStyleService: GroupStyleService) {}
}
