import { Module } from '@nestjs/common'
import { PassService } from './pass.service'
import { PassController } from './pass.controller'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { PassActivationRequestModule } from '../pass-activation-request'

@Module({
  imports: [PassActivationRequestModule],
  controllers: [PassController],
  providers: [
    PassService,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [PassService],
})
export class PassModule {}
