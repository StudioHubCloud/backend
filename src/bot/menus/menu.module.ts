import { Module, Scope } from '@nestjs/common'
import { GroupModule, PassTemplateModule, TrainingModule, UserProfileModule } from '@app/domain'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import {
  GroupSelectPaginatedMenu,
  ASSIGN_GROUP_TO_STAFF_MENU,
  REMOVE_GROUP_FROM_STAFF_MENU,
} from './paginated-menus/group-select.paginated-menu'
import { TrainingSelectPaginatedMenu } from './paginated-menus/training-select.paginated-menu'
import { VerificationInlineMenu } from './inline-menus/verification-requests.inline-menu'
import { TrainingSelectStaffPaginatedMenu } from './paginated-menus/training-select-staff.paginated-menu'
import { ClientSelectPaginatedMenu, CLIENT_SIGNIN_MENU, CLIENT_SIGNOUT_MENU } from './paginated-menus/client-select.paginated-menu'
import { StaffSelectPaginatedMenu } from './paginated-menus/staff-select.paginated-menu'
import { ActiveSchedulesPaginatedMenu } from './paginated-menus/active-schedules.paginated-menu'

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
    { provide: CLIENT_SIGNIN_MENU, useClass: ClientSelectPaginatedMenu },
    { provide: CLIENT_SIGNOUT_MENU, useClass: ClientSelectPaginatedMenu },
    { provide: ASSIGN_GROUP_TO_STAFF_MENU, useClass: GroupSelectPaginatedMenu },
    { provide: REMOVE_GROUP_FROM_STAFF_MENU, useClass: GroupSelectPaginatedMenu },
    { provide: APP.PROVIDERS.DATE_TIME_PROVIDER, useClass: DateTimeProvider },
  ],
  exports: [
    GroupSelectPaginatedMenu,
    ClientSelectPaginatedMenu,
    TrainingSelectPaginatedMenu,
    CLIENT_SIGNIN_MENU,
    CLIENT_SIGNOUT_MENU,
    ASSIGN_GROUP_TO_STAFF_MENU,
    REMOVE_GROUP_FROM_STAFF_MENU,
    VerificationInlineMenu,
    TrainingSelectStaffPaginatedMenu,
    StaffSelectPaginatedMenu,
    ActiveSchedulesPaginatedMenu,
  ],
})
export class MenuModule {}
