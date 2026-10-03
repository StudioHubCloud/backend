import { Module } from '@nestjs/common'
import { StaffMemberPayoutService } from './staff-member-payout.service'
import { APP } from '@app/libs'
import { GroupModule } from '../group'
import { StudioPayoutRuleModule } from '../studio-payout-rule'
import { TrainingModule } from '../training'
import { StaffMemberModule } from '../staff-member'
import { DateTimeProvider } from '@app/infrastructure/providers'

@Module({
  imports: [GroupModule, StudioPayoutRuleModule, TrainingModule, StaffMemberModule],
  providers: [
    StaffMemberPayoutService,
    {
      provide: APP.PROVIDERS.DATE_TIME_PROVIDER,
      useClass: DateTimeProvider,
    },
  ],
  exports: [StaffMemberPayoutService],
})
export class StaffMemberPayoutModule {}
