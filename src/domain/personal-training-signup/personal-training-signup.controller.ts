import { Controller } from '@nestjs/common'
import { PersonalTrainingSignupService } from './personal-training-signup.service'

@Controller('personal-training-signup')
export class PersonalTrainingSignupController {
  constructor(private readonly personalTrainingSignupService: PersonalTrainingSignupService) {}
}
