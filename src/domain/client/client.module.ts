import { Module } from '@nestjs/common'
import { ClientService } from './client.service'

@Module({
  imports: [],
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule {}
