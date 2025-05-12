import { Global, Module } from '@nestjs/common';
import { GroupSelectMenu } from './menus/group-select.menu';
import { TrainingSelectMenu } from './menus/training-select.menu';

@Global()
@Module({
  providers: [GroupSelectMenu, TrainingSelectMenu],
  exports: [GroupSelectMenu, TrainingSelectMenu]
})
export class InlineMenuModule {}