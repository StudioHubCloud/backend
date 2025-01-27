import { Module } from '@nestjs/common'
import { ApiController } from './api.controller'
import { ApiService } from './api.service'
import { DatabaseModule } from '@app/common'

@Module({
  imports: [DatabaseModule],
  controllers: [ApiController],
  providers: [ApiService],
})
export class ApiModule {}
