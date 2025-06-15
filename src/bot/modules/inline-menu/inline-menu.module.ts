import { Module } from '@nestjs/common'

import { ActiveSchedulesInlineMenu } from './menus/active-schedules.inline-menu'
import { GroupModule, PassTemplateModule, TrainingModule, TrainingSignupModule, UserProfileModule } from '@app/domain'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { GroupSelectPaginatedMenu } from './paginated-menus/group-select.paginated-menu'
import { TrainingSelectPaginatedMenu } from './paginated-menus/training-select.paginated-menu'
import { VerificationInlineMenu } from './menus/verification-requests.inline-menu'
import { TrainingSelectAdminPaginatedMenu } from './paginated-menus/training-select-admin.paginated-menu'
import { ClientSelectPaginatedMenu } from './paginated-menus/client-select.paginated-menu'

@Module({
  imports: [GroupModule, TrainingModule, TrainingSignupModule, UserProfileModule, PassTemplateModule],
  providers: [
    GroupSelectPaginatedMenu,
    ClientSelectPaginatedMenu,
    ActiveSchedulesInlineMenu,
    TrainingSelectPaginatedMenu,
    TrainingSelectAdminPaginatedMenu,
    VerificationInlineMenu,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [
    GroupSelectPaginatedMenu,
    ClientSelectPaginatedMenu,
    TrainingSelectPaginatedMenu,
    ActiveSchedulesInlineMenu,
    VerificationInlineMenu,
    TrainingSelectAdminPaginatedMenu,
  ],
})
export class InlineMenuModule {}
