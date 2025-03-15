import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { NestExpressApplication } from '@nestjs/platform-express'
import { API } from './libs'
import { TypedConfigService } from '@app/modules/infrastructure/config'
import { Logger } from 'nestjs-pino'
import { TelegramService } from '@bot/telegram'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  })
  const logger = app.get(Logger)
  app.useLogger(logger)
  app.setGlobalPrefix(API.GLOBAL_API_PREFIX_V1)

  const configService = app.get(TypedConfigService)
  const telegramService = app.get(TelegramService)

  await app.listen(configService.get('PORT'))
  await telegramService.init()
  logger.log(`Application is running on: ${await app.getUrl()}`)
}
bootstrap()
