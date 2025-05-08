import { Module } from '@nestjs/common'
import ClientComposers from './client'
import StaffComposers from './staff'
import GuestComposers from './guest'
import { ComposerService } from './composer.service'
import { GroupModule, GroupService } from '@app/domain/group'

@Module({
  imports: [GroupModule],
  providers: [ComposerService, ...GuestComposers, ...ClientComposers, ...StaffComposers, GroupService],
  exports: [ComposerService],
})
export class ComposerModule {}
