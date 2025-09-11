import { Module } from '@nestjs/common'
import { UserProfileService } from './user-profile.service'
import { ClientModule } from '../client'
import { PassModule } from '../pass'
import { StaffMemberModule } from '../staff-member'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'

@Module({
  imports: [ClientModule, PassModule, StaffMemberModule],
  providers: [
    UserProfileService,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [UserProfileService],
})
export class UserProfileModule {}
