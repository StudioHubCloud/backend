import { Module } from '@nestjs/common'
import { ClientService } from './client.service'
import { UserProfileModule } from '../user-profile'

@Module({
  imports: [UserProfileModule],
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule {}
