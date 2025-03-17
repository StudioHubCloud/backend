import { Global, Module } from '@nestjs/common'
import { StaffMainComposer } from './staff/staff.main.composer'
import { AdminMainComposer } from './admin/admin.main.composer'
import { ClientMainComposer } from './client/client.main.composer'
import { GuestMainComposer } from './guest/guest.main.composer'

@Global()
@Module({
  imports: [],
  providers: [StaffMainComposer, AdminMainComposer, ClientMainComposer, GuestMainComposer],
  exports: [],
})
export class ComposersModule {}
