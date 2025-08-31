import { Module } from '@nestjs/common'
import { StageService } from './stage.service'
import * as Stage from './scenes'
import { GroupModule, PassTemplateModule, TrainingSignupModule, UserProfileModule } from '@app/domain'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'

@Module({
  imports: [UserProfileModule, PassTemplateModule, TrainingSignupModule, GroupModule],
  providers: [
    StageService,
    Stage.RegisterScene,
    Stage.VerifyClientScene,
    Stage.SignInClientScene,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [StageService],
})
export class StageModule {}
