import { Module } from '@nestjs/common'
import { BusinessModule, CustomerModule, StudioModule } from '@app/modules/domain'
import { LoggerModule, ConfigModule, DatabaseModule } from '@app/modules/infrastructure'
import { TelegramModule } from './modules/bot/telegram/telegram.module'

@Module({
  imports: [BusinessModule, CustomerModule, StudioModule, LoggerModule, ConfigModule, DatabaseModule, TelegramModule],
  providers: [],
})
export class AppModule {}
