import { Module } from '@nestjs/common'
import { GroupScheduleModule, PassModule, TrainingModule, TrainingSignupModule, GroupModule, UserProfileModule } from '@app/domain'
import ClientComposers from './client'
import TrainerComposers from './trainer'
import AdminComposers from './admin'
import GuestComposers from './guest'
import CommonComposers from './common'
import { ComposerService } from './composer.service'
import { InlineMenuModule } from '../inline-menu/inline-menu.module'

@Module({
  imports: [GroupModule, TrainingModule, InlineMenuModule, TrainingSignupModule, GroupScheduleModule, PassModule, UserProfileModule],
  providers: [ComposerService, ...GuestComposers, ...ClientComposers, ...AdminComposers, ...TrainerComposers, ...CommonComposers],
  exports: [ComposerService],
})
export class ComposerModule {}
