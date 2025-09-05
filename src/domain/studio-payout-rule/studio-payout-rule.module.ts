import { Module } from '@nestjs/common'
import { StudioPayoutRuleController } from './studio-payout-rule.controller'
import { StudioPayoutRuleService } from './studio-payout-rule.service'

@Module({
  controllers: [StudioPayoutRuleController],
  providers: [StudioPayoutRuleService],
  exports: [StudioPayoutRuleService],
})
export class StudioPayoutRuleModule {}
