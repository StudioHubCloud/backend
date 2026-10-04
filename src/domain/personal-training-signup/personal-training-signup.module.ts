import { Module } from '@nestjs/common'
import { PersonalTrainingSignupService } from './personal-training-signup.service'
import { PersonalTrainingSignupController } from './personal-training-signup.controller'
import { PassModule } from '../pass'
import { TrainingModule } from '../training'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'

@Module({
  imports: [PassModule, TrainingModule],
  controllers: [PersonalTrainingSignupController],
  providers: [
    PersonalTrainingSignupService,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [PersonalTrainingSignupService],
})
export class PersonalTrainingSignupModule {}
