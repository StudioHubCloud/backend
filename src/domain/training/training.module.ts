import { Module } from '@nestjs/common'
import { TrainingService } from './training.service'
import { TrainingController } from './training.controller'
import { StudioModule } from '../studio'
import { APP } from '@app/libs'
import { DateTimeService } from '@app/infrastructure/providers'
import { UserProfileModule } from '../user-profile'
import { PassModule } from '../pass'

@Module({
  imports: [StudioModule, UserProfileModule, PassModule],
  controllers: [TrainingController],
  providers: [
    TrainingService,
    {
      provide: APP.PROVIDERS.DATE_TIME_SERVICE,
      useClass: DateTimeService,
    },
  ],
  exports: [TrainingService],
})
export class TrainingModule {}
