import { Module } from '@nestjs/common'
import { BusinessService } from './business.service'

@Module({
  imports: [],
  controllers: [],
  providers: [BusinessService],
  exports: [BusinessService],
})
export class BusinessModule {}
