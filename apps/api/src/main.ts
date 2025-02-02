import { NestFactory } from '@nestjs/core'
import { ApiModule } from './api.module'
import { API } from '@app/common'

async function bootstrap() {
  const app = await NestFactory.create(ApiModule)
  await app.listen(process.env.port ?? 3000)
  app.setGlobalPrefix(API.GLOBAL_API_PREFIX)
}
bootstrap()
