import { Module, Scope } from '@nestjs/common'
import { GroupModule, PassTemplateModule, TrainingModule, UserProfileModule } from '@app/domain'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { GroupSelectPaginatedMenu } from './paginated-menus/group-select.paginated-menu'
import { TrainingSelectPaginatedMenu } from './paginated-menus/training-select.paginated-menu'
import { VerificationInlineMenu } from './inline-menus/verification-requests.inline-menu'
import { TrainingSelectStaffPaginatedMenu } from './paginated-menus/training-select-staff.paginated-menu'
import { ClientSelectPaginatedMenu, CLIENT_SIGNOUT_MENU } from './paginated-menus/client-select.paginated-menu'
import { StaffSelectPaginatedMenu } from './paginated-menus/staff-select.paginated-menu'
import { ActiveSchedulesPaginatedMenu } from './paginated-menus/active-schedules.paginated-menu'
import { GroupService } from '@app/domain/group'

@Module({
  imports: [GroupModule, TrainingModule, UserProfileModule, PassTemplateModule],
  providers: [
    GroupSelectPaginatedMenu,
    TrainingSelectPaginatedMenu,
    TrainingSelectStaffPaginatedMenu,
    VerificationInlineMenu,
    ClientSelectPaginatedMenu,
    StaffSelectPaginatedMenu,
    ActiveSchedulesPaginatedMenu,
    {
      provide: CLIENT_SIGNOUT_MENU,
      useFactory: (groupService: GroupService) => new ClientSelectPaginatedMenu(groupService),
      inject: [GroupService],
      scope: Scope.TRANSIENT,
    },
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [
    GroupSelectPaginatedMenu,
    ClientSelectPaginatedMenu,
    TrainingSelectPaginatedMenu,
    CLIENT_SIGNOUT_MENU,
    VerificationInlineMenu,
    TrainingSelectStaffPaginatedMenu,
    StaffSelectPaginatedMenu,
    ActiveSchedulesPaginatedMenu
  ],
})
export class MenuModule {}
