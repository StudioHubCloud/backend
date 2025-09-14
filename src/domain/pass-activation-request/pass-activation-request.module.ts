import { Module } from '@nestjs/common'
import { PassActivationRequestService } from './pass-activation-request.service'

@Module({
  imports: [],
  providers: [PassActivationRequestService],
  exports: [PassActivationRequestService],
})
export class PassActivationRequestModule {}
