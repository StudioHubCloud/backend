import { Controller } from '@nestjs/common';
import { PassService } from './pass.service';

@Controller('pass')
export class PassController {
  constructor(private readonly passService: PassService) {}
}
