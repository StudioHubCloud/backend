import { Module } from '@nestjs/common'
import { DatabaseModule, LoggerModule } from '@app/common'
import { ConfigModule } from '@nestjs/config'
import { envValidationSchema, TApiEnv } from './validation-schema'
import { BusinessModule, CustomerModule, StudioModule } from './modules'

@Module({
  imports: [
    BusinessModule,
    CustomerModule,
    StudioModule,
    DatabaseModule,
    LoggerModule,
    ConfigModule.forRoot<TApiEnv>({
      validate: (env) => envValidationSchema.parse(env),
    }),
  ],
  providers: [],
})
export class ApiModule {}
