import { Module } from '@nestjs/common'
import { PersonalTrainingSignupService } from './personal-training-signup.service'
import { PersonalTrainingSignupController } from './personal-training-signup.controller'
import { PassModule } from '../pass'

@Module({
  imports: [PassModule],
  controllers: [PersonalTrainingSignupController],
  providers: [PersonalTrainingSignupService],
  exports: [PersonalTrainingSignupService],
})
export class PersonalTrainingSignupModule {}
