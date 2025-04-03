import { Controller } from '@nestjs/common';
import { GroupStyleVariantService } from './group-style-variant.service';

@Controller('group-style-variant')
export class GroupStyleVariantController {
  constructor(private readonly groupStyleVariantService: GroupStyleVariantService) {}
}
