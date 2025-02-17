import { Module, DynamicModule } from '@nestjs/common'
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config'
import { z, ZodSchema } from 'zod'

@Module({})
export class ConfigModule {
  static forRoot<T extends Record<string, any>>({ validationSchema }: { validationSchema: ZodSchema<T> }): DynamicModule {
    return {
      module: ConfigModule,
      global: true,
      imports: [
        NestConfigModule.forRoot({
          validate: (config) => {
            const parsed = validationSchema.safeParse(config)
            if (!parsed.success) {
              throw new Error(`Config validation error: ${parsed.error.message}`)
            }
            return parsed.data
          },
        }),
      ],
      providers: [
        {
          provide: ConfigService,
          useClass: ConfigService<T>,
        },
      ],
      exports: [ConfigService],
    }
  }
}
