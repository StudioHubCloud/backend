import { Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config'
import { z } from 'zod'

@Module({
  imports: [
    NestConfigModule.forRoot({
      validate: (config) =>
        z
          .object({
            PORT: z.coerce.number().optional().default(3000),
            DB_PORT: z.coerce.number(),
            DB_USER: z.string(),
            DB_PASS: z.string(),
            DB_NAME: z.string(),
          })
          .parse(config),
      isGlobal: true,
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
