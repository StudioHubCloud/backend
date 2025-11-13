import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { NestExpressApplication } from '@nestjs/platform-express'
import { API, ENVIRONMENTS } from './libs'
import { TypedConfigService } from '@app/infrastructure/config'
import { Logger } from 'nestjs-pino'
import { BotService } from 'src/bot/bot.service'
import { RedisCacheService } from './infrastructure/redis'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  })
  const logger = app.get(Logger)
  app.useLogger(logger)
  app.setGlobalPrefix(API.GLOBAL_API_PREFIX_V1)

  const configService = app.get(TypedConfigService)
  const botService = app.get(BotService);
  const redisCacheService = app.get(RedisCacheService);

  
  if (configService.isProduction()) {
    app.use(await botService.getWebhookMiddleware())
  } else {
    botService.startPolling()
  }
  
  await app.listen(configService.get('PORT'))
  logger.log(`Application is running on: ${await app.getUrl()}`)

  process.once('SIGINT', async () => {
    logger.log('SIGINT received. Stopping app gracefully...');
    botService.stopBot('SIGINT');
    redisCacheService.reset();
    await app.close();
  });

  process.once('SIGTERM', async () => {
    logger.log('SIGTERM received. Stopping app gracefully...');
    botService.stopBot('SIGTERM');
    redisCacheService.reset();
    await app.close();
  });
}
bootstrap()
