import { ENVIRONMENTS } from '@app/libs'
import { Global, Module } from '@nestjs/common'
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino'
import { ConfigModule, TypedConfigService } from '../config';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [TypedConfigService],
      useFactory: async (configService: TypedConfigService) => {
        const isProduction = configService.get('NODE_ENV') === ENVIRONMENTS.PRODUCTION;
        const pinoHttpLevel = configService.get('LOG_LEVEL_HTTP')
        const pinoLevel = configService.get('LOG_LEVEL')

        return {
          pinoHttp: {
            level: pinoHttpLevel,
            transport: isProduction
              ? undefined 
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                  },
                },
          },
          pino: {
            level: pinoLevel,
          },
          // Add this if use Nest default error code
          // exclude: [
          //   { method: RequestMethod.ALL, path: 'health' },
          // ],
          // for routes not requiring logger
          // Redact options: https://getpino.io/#/docs/redact
          // to prevent logging sensitive information, defaults to false.
          // The redacted keys will be replaced with '[Redacted]'
          // redact: {
          //   paths: ['req.headers.cookie', 'res.headers["set-cookie"]'],
          //   censor: '[Redacted]'
          // }
        };
      },
    }),
  ],
})
export class LoggerModule {}
