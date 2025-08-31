import { GuardComposer } from './guard.composer'
import { SchedulerComposer } from './scheduler.composer'
import { PaymentComposer } from './payment.composer'
import { RulesGuardComposer } from './rules-guard.composer'
import { GroupManageComposer } from './group-manage.composer'
import { StaffPayoutComposer } from './staff-payout.composer'

export default [SchedulerComposer, GuardComposer, PaymentComposer, RulesGuardComposer, GroupManageComposer, StaffPayoutComposer]
