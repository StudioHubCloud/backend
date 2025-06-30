import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'

@Injectable()
export class UserProfileFeedbackNotificationService {
  constructor(
    private readonly logger: PinoLogger,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {}
}
