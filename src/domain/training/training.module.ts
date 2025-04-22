import { Module } from '@nestjs/common'
import { TrainingService } from './training.service'
import { TrainingController } from './training.controller'
import { StudioModule, StudioService } from '../studio'
import { APP } from '@app/libs'
import { DateTimeService } from '@app/infrastructure/providers'

@Module({
  imports: [StudioModule],
  controllers: [TrainingController],
  providers: [
    TrainingService,
    StudioService,
    {
      provide: APP.PROVIDERS.DATE_TIME_SERVICE,
      useClass: DateTimeService,
    },
  ],
})
export class TrainingModule {}
