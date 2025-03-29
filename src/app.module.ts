import { Module } from '@nestjs/common'
import { BusinessModule, CustomerModule, StudioModule, ClientModule, UserProfileModule } from '@app/domain'
import { LoggerModule, ConfigModule, DatabaseModule } from '@app/infrastructure'
import { BotModule } from 'src/bot/bot.module'
import { HealthModule } from './infrastructure/health'

@Module({
  imports: [
    BusinessModule,
    CustomerModule,
    StudioModule,
    ClientModule,
    LoggerModule,
    ConfigModule,
    DatabaseModule,
    UserProfileModule,
    HealthModule,
    BotModule,
  ],
  providers: [],
})
export class AppModule {}
