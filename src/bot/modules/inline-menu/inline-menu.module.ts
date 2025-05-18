import {  Module } from '@nestjs/common'
import { GroupSelectMenu } from './menus/group-select.menu'
import { TrainingSelectMenu } from './menus/training-select.menu'
import { GroupModule, TrainingModule } from '@app/domain'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'

@Module({
  imports: [GroupModule, TrainingModule],
  providers: [
    GroupSelectMenu,
    TrainingSelectMenu,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [GroupSelectMenu, TrainingSelectMenu],
})
export class InlineMenuModule {}
