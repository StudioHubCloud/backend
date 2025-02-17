import { Global, Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config'
import { envValidationSchema } from '@app/libs' // Adjust the import path as needed

@Module({
  imports: [
    NestConfigModule.forRoot({
      validate: (config) => {
        const parsed = envValidationSchema.safeParse(config)
        if (!parsed.success) {
          throw new Error(`Config validation error: ${parsed.error.message}`)
        }
        return parsed.data
      },
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
