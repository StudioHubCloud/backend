import { Module } from '@nestjs/common'
import ClientComposers from './client'
import StaffComposers from './staff'
import GuestComposers from './guest'
import CommonComposers from './common'
import { ComposerService } from './composer.service'
import { GroupModule } from '@app/domain/group'

@Module({
  imports: [GroupModule],
  providers: [ComposerService, ...GuestComposers, ...ClientComposers, ...StaffComposers, ...CommonComposers],
  exports: [ComposerService],
})
export class ComposerModule {}
