import { Module } from '@nestjs/common'
import { UserProfileService } from './user-profile.service'
import { ClientModule } from '../client'
import { PassModule } from '../pass'

@Module({
  imports: [ClientModule, PassModule],
  providers: [UserProfileService],
  controllers: [],
  exports: [UserProfileService],
})
export class UserProfileModule {}
