import { Module } from '@nestjs/common';
import { GroupStyleService } from './group-style.service';
import { GroupStyleController } from './group-style.controller';

@Module({
  controllers: [GroupStyleController],
  providers: [GroupStyleService],
})
export class GroupStyleModule {}
