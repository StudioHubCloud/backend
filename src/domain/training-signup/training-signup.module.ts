import { forwardRef, Module } from '@nestjs/common'
import { TrainingSignupService } from './training-signup.service'
import { TrainingSignupController } from './training-signup.controller'
import { PassModule } from '../pass'
import { TrainingModule } from '../training/training.module'
import { GroupAgeRestrictionModule } from '../group-age-restriction'

@Module({
  imports: [PassModule, GroupAgeRestrictionModule, forwardRef(() => TrainingModule)],
  controllers: [TrainingSignupController],
  providers: [TrainingSignupService],
  exports: [TrainingSignupService],
})
export class TrainingSignupModule {}
