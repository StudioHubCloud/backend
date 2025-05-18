import { Module } from '@nestjs/common'
import { GroupAgeRestrictionExeptionService } from './group-age-restriction-exeption.service';

@Module({
  providers: [GroupAgeRestrictionExeptionService],
  exports: [GroupAgeRestrictionExeptionService],
})
export class GroupAgeRestrictionExeptionModule {}
