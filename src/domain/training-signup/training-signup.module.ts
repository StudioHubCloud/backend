import { forwardRef, Module } from '@nestjs/common'
import { TrainingSignupService } from './training-signup.service'
import { TrainingSignupController } from './training-signup.controller'
import { PassModule } from '../pass'
import { TrainingModule } from '../training/training.module'
import { GroupAgeRestrictionModule } from '../group-age-restriction'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { UserProfileModule } from '../user-profile'

@Module({
  imports: [PassModule, GroupAgeRestrictionModule, forwardRef(() => TrainingModule), UserProfileModule],
  controllers: [TrainingSignupController],
  providers: [
    TrainingSignupService,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [TrainingSignupService],
})
export class TrainingSignupModule {}
