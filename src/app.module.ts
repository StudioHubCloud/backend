import { Module } from '@nestjs/common'
import { BusinessModule, CustomerModule, StudioModule, ClientModule, UserProfileModule } from '@app/domain'
import { LoggerModule, ConfigModule, DatabaseModule, RedisCacheModule, CronModule, HealthModule } from '@app/infrastructure'
import { BotModule } from 'src/bot/bot.module'

@Module({
  imports: [
    BusinessModule,
    CustomerModule,
    StudioModule,
    ClientModule,
    LoggerModule,
    ConfigModule,
    DatabaseModule,
    RedisCacheModule,
    UserProfileModule,
    HealthModule,
    BotModule,
    CronModule,
  ],
  providers: [],
})
export class AppModule {}
