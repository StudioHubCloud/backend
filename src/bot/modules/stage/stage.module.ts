import { Module } from '@nestjs/common'
import { StageService } from './stage.service'
import * as Stage from './scenes'
import { UserProfileModule } from '@app/domain'
import { APP } from '@app/libs'
import { DateTimeService } from '@app/infrastructure/providers'

@Module({
  imports: [UserProfileModule],
  providers: [
    StageService,
    Stage.VerificationRequestScene,
    {
      provide: APP.PROVIDERS.DATE_TIME_SERVICE,
      useClass: DateTimeService,
    },
  ],
  exports: [StageService],
})
export class StageModule {}
