import { Module } from '@nestjs/common'
import { BusinessModule, CustomerModule, StudioModule } from '@app/modules/domain'
import { LoggerModule, ConfigModule, DatabaseModule } from '@app/modules/infrastructure'

@Module({
  imports: [BusinessModule, CustomerModule, StudioModule, LoggerModule, ConfigModule, DatabaseModule],
  providers: [],
})
export class ApiModule {}
