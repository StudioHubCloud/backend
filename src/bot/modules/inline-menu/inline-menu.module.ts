import { Module } from '@nestjs/common'

import { ActiveSchedulesInlineMenu } from './menus/active-schedules.inline-menu'
import { GroupModule, PassTemplateModule, TrainingModule, TrainingSignupModule, UserProfileModule } from '@app/domain'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { GroupSelectInlineMenu } from './paginated-menus/group-select.inline-menu'
import { TrainingSelectInlineMenu } from './paginated-menus/training-select.inline-menu'
import { VerificationInlineMenu } from './menus/verification-requests.inline-menu'

@Module({
  imports: [GroupModule, TrainingModule, TrainingSignupModule, UserProfileModule, PassTemplateModule],
  providers: [
    GroupSelectInlineMenu,
    ActiveSchedulesInlineMenu,
    TrainingSelectInlineMenu,
    VerificationInlineMenu,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [GroupSelectInlineMenu, TrainingSelectInlineMenu, ActiveSchedulesInlineMenu, VerificationInlineMenu],
})
export class InlineMenuModule {}
