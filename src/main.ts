import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { NestExpressApplication } from '@nestjs/platform-express'
import { API } from './libs'
import { TypedConfigService } from '@app/infrastructure/config'
import { Logger } from 'nestjs-pino'
import { BotService } from '@app/bot/bot.service'
import { ValidationPipe } from '@nestjs/common'
import helmet from 'helmet'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  })
  const logger = app.get(Logger)
  app.useLogger(logger)
  app.use(helmet())
  app.setGlobalPrefix(API.GLOBAL_API_PREFIX_V1)
  app.enableShutdownHooks()
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  const configService = app.get(TypedConfigService)
  const botService = app.get(BotService)

  if (configService.isProduction()) {
    app.use(await botService.getWebhookMiddleware())
  } else {
    botService.startPolling()
  }

  await app.listen(configService.get('PORT'))
  logger.log(`Application is running on: ${await app.getUrl()}`)
}
bootstrap()
