import { GuardComposer } from './guard.composer'
import { SchedulerComposer } from './scheduler.composer'
import { PaymentComposer } from './payment.composer'
import { RulesGuardComposer } from './rules-guard.composer'
import { GroupManageStaffComposer } from './group-manage-staff.composer'
import { PayoutStaffComposer } from './payout-staff.composer'

export default [
  SchedulerComposer,
  GuardComposer,
  PaymentComposer,
  RulesGuardComposer,
  GroupManageStaffComposer,
  PayoutStaffComposer,
]
