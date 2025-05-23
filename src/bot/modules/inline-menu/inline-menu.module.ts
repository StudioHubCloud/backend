import { Module } from '@nestjs/common'

import { ActiveSchedulesInlineMenu } from './menus/active-schedules.inline-menu'
import { GroupModule, TrainingModule, TrainingSignupModule } from '@app/domain'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { GroupSelectInlineMenu } from './paginated-menus/group-select.inline-menu'
import { TrainingSelectInlineMenu } from './paginated-menus/training-select.inline-menu'

@Module({
  imports: [GroupModule, TrainingModule, TrainingSignupModule],
  providers: [
    GroupSelectInlineMenu,
    ActiveSchedulesInlineMenu,
    TrainingSelectInlineMenu,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [GroupSelectInlineMenu, TrainingSelectInlineMenu, ActiveSchedulesInlineMenu],
})
export class InlineMenuModule {}
