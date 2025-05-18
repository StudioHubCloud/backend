import { Module } from '@nestjs/common'
import { TrainingService } from './training.service'
import { TrainingController } from './training.controller'
import { StudioModule } from '../studio'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { PassModule } from '../pass'

@Module({
  imports: [StudioModule, PassModule],
  controllers: [TrainingController],
  providers: [
    TrainingService,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [TrainingService],
})
export class TrainingModule {}
