import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { TypedConfigService } from '@app/infrastructure/config'
import { DatabaseService, payment, StudioPayoutRuleSelectModel, Transaction } from '@app/infrastructure/database'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'

import { RedisCacheService, PaymentCacheKey } from '@app/infrastructure/redis'

@Injectable()
export class PaymentService {
  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
    private readonly configService: TypedConfigService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

}
