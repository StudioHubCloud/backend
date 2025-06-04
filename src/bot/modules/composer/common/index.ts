import { GuardComposer } from './guard.composer'
import { SchedulerComposer } from './scheduler.composer'
import { PaymentComposer } from './payment.composer'
import { RulesGuardComposer } from './rules-guard.composer'

export default [SchedulerComposer, GuardComposer, PaymentComposer, RulesGuardComposer]
