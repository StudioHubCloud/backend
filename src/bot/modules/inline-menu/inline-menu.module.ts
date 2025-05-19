import {  Module } from '@nestjs/common'
import { GroupSelectMenu } from './menus/group-select.menu'
import { TrainingSelectMenu } from './menus/training-select.menu'
import { ActiveSchedulesMenu } from './menus/active-schedules.menu'
import { GroupModule, TrainingModule, TrainingSignupModule } from '@app/domain'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'

@Module({
  imports: [GroupModule, TrainingModule, TrainingSignupModule],
  providers: [
    GroupSelectMenu,
    ActiveSchedulesMenu,
    TrainingSelectMenu,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [GroupSelectMenu, TrainingSelectMenu, ActiveSchedulesMenu],
})
export class InlineMenuModule {}
