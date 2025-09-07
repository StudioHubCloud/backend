import { Module } from '@nestjs/common'
import { GroupService } from './group.service'
import { GroupController } from './group.controller'
import { UserProfileModule } from '../user-profile'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { StaffMemberModule } from '../staff-member'

@Module({
  controllers: [GroupController],
  imports: [UserProfileModule, StaffMemberModule],
  providers: [
    GroupService,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [GroupService],
})
export class GroupModule {}
