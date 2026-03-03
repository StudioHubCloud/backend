import { Module } from '@nestjs/common'
import { UserRegisterService } from './user-register.service'

@Module({
  imports: [],
  providers: [UserRegisterService],
  exports: [UserRegisterService],
})
export class UserRegisterModule {}
