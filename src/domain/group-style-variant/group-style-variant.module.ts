import { Module } from '@nestjs/common';
import { GroupStyleVariantService } from './group-style-variant.service';
import { GroupStyleVariantController } from './group-style-variant.controller';

@Module({
  controllers: [GroupStyleVariantController],
  providers: [GroupStyleVariantService],
})
export class GroupStyleVariantModule {}
