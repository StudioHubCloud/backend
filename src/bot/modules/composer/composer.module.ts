import { Module } from '@nestjs/common'
import { ClientComposer } from './client/client.composer'
import { GuestComposer } from './guest/guest.composer'
import { StaffComposer } from './staff/staff.composer'
import { ComposerService } from './composer.service'

@Module({
  imports: [],
  providers: [ClientComposer, GuestComposer, StaffComposer, ComposerService],
  exports: [ComposerService],
})
export class ComposerModule {}
