import { Module } from '@nestjs/common'
import { ApiController } from './api.controller'
import { ApiService } from './api.service'
import { DatabaseModule, LoggerModule } from '@app/common'

@Module({
  imports: [DatabaseModule, LoggerModule],
  controllers: [ApiController],
  providers: [ApiService],
})
export class ApiModule {}
