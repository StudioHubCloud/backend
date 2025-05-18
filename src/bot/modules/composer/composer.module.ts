import { Module } from '@nestjs/common'
import ClientComposers from './client'
import StaffComposers from './staff'
import GuestComposers from './guest'
import CommonComposers from './common'
import { ComposerService } from './composer.service'
import { GroupModule } from '@app/domain/group'
import { TrainingModule, TrainingSignupModule } from '@app/domain'
import { InlineMenuModule } from '../inline-menu/inline-menu.module'

@Module({
  imports: [GroupModule, TrainingModule, InlineMenuModule, TrainingSignupModule],
  providers: [ComposerService, ...GuestComposers, ...ClientComposers, ...StaffComposers, ...CommonComposers],
  exports: [ComposerService],
})
export class ComposerModule {}
