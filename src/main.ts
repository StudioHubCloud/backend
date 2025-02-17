import { NestFactory } from '@nestjs/core'
import { ApiModule } from './api.module'
import { API, EnvVariables } from './libs'
import { ConfigService } from '@nestjs/config'
import { Logger } from 'nestjs-pino'

async function bootstrap() {
  const app = await NestFactory.create(ApiModule, {
    bufferLogs: true,
  })
  const logger = app.get(Logger)
  app.useLogger(logger)
  app.setGlobalPrefix(API.GLOBAL_API_PREFIX)

  const configService = app.get(ConfigService<EnvVariables>)

  await app.listen(configService.getOrThrow('PORT'))
  logger.log(`Application is running on: ${await app.getUrl()}`)
}
bootstrap()
