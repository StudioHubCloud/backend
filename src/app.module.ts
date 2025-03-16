import { Module } from '@nestjs/common'
import { BusinessModule, CustomerModule, StudioModule, ClientModule } from '@app/modules/domain'
import { LoggerModule, ConfigModule, DatabaseModule } from '@app/modules/infrastructure'
import { TelegramModule } from '@bot/telegram'

@Module({
  imports: [BusinessModule, CustomerModule, StudioModule, ClientModule, LoggerModule, ConfigModule, DatabaseModule, TelegramModule],
  providers: [],
})
export class AppModule {}
