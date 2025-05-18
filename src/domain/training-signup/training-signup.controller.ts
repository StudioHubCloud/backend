import { Controller } from '@nestjs/common'
import { TrainingSignupService } from './training-signup.service'

@Controller('training-signup')
export class TrainingSignupController {
  constructor(private readonly trainingSignupService: TrainingSignupService) {}
}
