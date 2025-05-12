import { Module } from '@nestjs/common';
import { PassService } from './pass.service';
import { PassController } from './pass.controller';

@Module({
  controllers: [PassController],
  providers: [PassService],
  exports: [PassService],
})
export class PassModule {}
