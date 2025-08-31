import { Module } from '@nestjs/common'
import { UserProfileService } from './user-profile.service'
import { ClientModule } from '../client'
import { PassModule } from '../pass'
import { StaffMemberModule } from '../staff-member'

@Module({
  imports: [ClientModule, PassModule, StaffMemberModule],
  providers: [UserProfileService],
  exports: [UserProfileService],
})
export class UserProfileModule {}
