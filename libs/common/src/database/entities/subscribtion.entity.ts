import { Column, JoinColumn, ManyToOne, OneToOne } from 'typeorm'
import { Mixin } from 'ts-mixer'
import { UuidIdBaseMixin } from '../mixin-entities'
import { SubscribtionTier, SUBSCRIBTION, SubscribtionStatus } from '@app/common'
import type { SubscribtionPlan } from './subscribtion-plan.entity'
import type { Customer } from './customer.entity'

export class Subscribtion extends Mixin(UuidIdBaseMixin) {
  @Column({ type: 'timestamp', nullable: true })
  paused_from_date: Date | null

  @Column({ type: 'timestamp', nullable: true })
  paused_to_date: Date | null

  @Column({ type: 'timestamp', nullable: true })
  expired_from_date: Date | null

  @Column({
    type: 'enum',
    enum: Object.values(SUBSCRIBTION.TIER),
    enumName: 'subscribtion_tier',
    default: SUBSCRIBTION.TIER.BASIC,
  })
  subscribtionTier: SubscribtionTier

  @Column({
    type: 'enum',
    enum: Object.values(SUBSCRIBTION.STATUS),
    enumName: 'customer_subscribtion_status',
    default: SUBSCRIBTION.STATUS.ACTIVE,
  })
  subscribtionStatus: SubscribtionStatus

  @OneToOne('Customer', (customer: Customer) => customer.subscribtion, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  customer: Customer

  @ManyToOne('SubscribtionPlan', (sp: SubscribtionPlan) => sp.subscribtions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'subscribtion_plan_id' })
  subscribtion_plan: SubscribtionPlan
}
