import { GuardComposer } from './guard.composer'
import { SchedulerComposer } from './scheduler.composer'
import { PaymentComposer } from './payment.composer'

export default [SchedulerComposer, GuardComposer, PaymentComposer]
