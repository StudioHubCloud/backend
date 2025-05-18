import { Module } from '@nestjs/common'
import { GroupAgeRestrictionService } from './group-age-restriction.service'
import { UserProfileModule } from '../user-profile'
import { GroupModule } from '../group/group.module'

@Module({
  imports: [UserProfileModule, GroupModule],
  providers: [GroupAgeRestrictionService],
  exports: [GroupAgeRestrictionService],
})
export class GroupAgeRestrictionModule {}
