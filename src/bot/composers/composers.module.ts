import { Global, Module } from '@nestjs/common'
import { StartComposer, StaffComposer, AdminComposer, ClientComposer, GuestComposer } from './services'

@Global()
@Module({
  imports: [],
  providers: [StartComposer, StaffComposer, AdminComposer, ClientComposer, GuestComposer],
  exports: [StartComposer],
})
export class ComposersModule {}
