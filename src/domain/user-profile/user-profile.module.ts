import { Module } from '@nestjs/common'
import { UserProfileService } from './user-profile.service'

@Module({
  providers: [UserProfileService],
  controllers: [],
  exports: [UserProfileService],
})
export class UserProfileModule {}
