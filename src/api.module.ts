import { Module } from '@nestjs/common'
import { DatabaseModule, LoggerModule, ConfigModule } from '@app/common'
import { envValidationSchema, TApiEnv } from './validation-schema'
import { BusinessModule, CustomerModule, StudioModule } from './modules'

@Module({
  imports: [
    BusinessModule,
    CustomerModule,
    StudioModule,
    LoggerModule,
    ConfigModule.forRoot({
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
  ],
  providers: [],
})
export class ApiModule {}
