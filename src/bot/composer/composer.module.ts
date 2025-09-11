import { Module } from '@nestjs/common'
import {
  GroupScheduleModule,
  PassModule,
  TrainingModule,
  TrainingSignupModule,
  GroupModule,
  UserProfileModule,
  StaffMemberPayoutModule,
} from '@app/domain'
import ClientComposers from './client'
import TrainerComposers from './trainer'
import AdminComposers from './admin'
import GuestComposers from './guest'
import CommonComposers from './common'
import { ComposerService } from './composer.service'
import { MenuModule } from '@app/bot/menus/menu.module'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'

@Module({
  imports: [
    GroupModule,
    TrainingModule,
    MenuModule,
    TrainingSignupModule,
    GroupScheduleModule,
    PassModule,
    UserProfileModule,
    StaffMemberPayoutModule,
  ],
  providers: [
    ComposerService,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
    ...GuestComposers,
    ...ClientComposers,
    ...AdminComposers,
    ...TrainerComposers,
    ...CommonComposers,
  ],
  exports: [ComposerService],
})
export class ComposerModule {}
