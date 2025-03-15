import { Global, Module } from '@nestjs/common'
import { StartComposer, StaffComposer, AdminComposer, ClientComposer, GuestComposer } from './files'

@Global()
@Module({
  imports: [],
  providers: [StartComposer, StaffComposer, AdminComposer, ClientComposer, GuestComposer],
  exports: [StartComposer],
})
export class ComposersModule {}
