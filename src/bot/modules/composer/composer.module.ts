import { Module } from '@nestjs/common'
import ClientComposers from './client'
import StaffComposers from './staff'
import GuestComposers from './guest'
import { ComposerService } from './composer.service'
import { GroupModule } from '@app/domain/group'

@Module({
  imports: [GroupModule],
  providers: [ComposerService, ...GuestComposers, ...ClientComposers, ...StaffComposers],
  exports: [ComposerService],
})
export class ComposerModule {}
