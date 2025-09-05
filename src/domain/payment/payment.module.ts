import { Module } from '@nestjs/common'
import { PaymentController } from './payment.controller'
import { PaymentService } from './payment.service'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { GroupModule } from '../group'
import { StudioPayoutRuleModule } from '../studio-payout-rule'
import { TrainingModule } from '../training'
import { StaffMemberModule } from '../staff-member'

@Module({
  controllers: [PaymentController],

  imports: [GroupModule, StudioPayoutRuleModule, TrainingModule, StaffMemberModule],
  providers: [
    PaymentService,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
