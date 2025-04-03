import { Module } from '@nestjs/common';
import { SubscribtionService } from './subscribtion.service';
import { SubscribtionController } from './subscribtion.controller';

@Module({
  controllers: [SubscribtionController],
  providers: [SubscribtionService],
})
export class SubscribtionModule {}
