import { Column, Entity, OneToMany } from 'typeorm'
import { Mixin } from 'ts-mixer'
import { UuidIdBaseMixin } from '../mixin-entities'
import { SUBSCRIBTION, SubscribtionTier } from '@app/common'
import type { Subscribtion } from './subscribtion.entity'

@Entity({ name: 'subscribtion_plan' })
export class SubscribtionPlan extends Mixin(UuidIdBaseMixin) {
  @Column({ type: 'varchar', length: 255 })
  title: string

  @Column({ type: 'enum', enum: Object.values(SUBSCRIBTION.TIER) })
  tier: SubscribtionTier

  @Column({ type: 'varchar', length: 255 })
  description: string

  @Column({ type: 'int' })
  price: number

  @Column({ type: 'varchar', length: 255 })
  currency_code_3: string

  @OneToMany('Subscribtion', (subscribtion: Subscribtion) => subscribtion.subscribtion_plan)
  subscribtions: Subscribtion[]
}
