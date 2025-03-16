import { Module } from '@nestjs/common'
import { UserProfileService } from './user-profile.service'

@Module({
  imports: [],
  providers: [UserProfileService],
  controllers: [],
  exports: [UserProfileService],
})
export class UserProfileModule {}
