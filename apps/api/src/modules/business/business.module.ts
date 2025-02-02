import { Module } from '@nestjs/common'
import { BusinessService } from './business.service'
import { BusinessController } from './business.controller'
import { DatabaseModule, BusinessEntity } from '@app/common'

@Module({
  imports: [DatabaseModule.forFeature([BusinessEntity])],
  controllers: [BusinessController],
  providers: [BusinessService],
})
export class BusinessModule {}
