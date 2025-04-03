import { Controller } from '@nestjs/common';
import { SubscribtionService } from './subscribtion.service';

@Controller('subscribtion')
export class SubscribtionController {
  constructor(private readonly subscribtionService: SubscribtionService) {}
}
