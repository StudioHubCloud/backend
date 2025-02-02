import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm'
import { Mixin } from 'ts-mixer'
import { UuidIdBaseMixin } from '../mixin-entities'
import { USER_PROFILE } from '@app/common'
import type { Business } from './business.entity'
import type { Subscribtion } from './subscribtion.entity'

@Entity({ name: 'customer' })
export class Customer extends Mixin(UuidIdBaseMixin) {
  @Column({ type: 'varchar', length: 255 })
  fullName: string

  @Column({ type: 'varchar', length: 255, unique: true })
  emailAddress: string

  @Column({ type: 'varchar', length: 255, unique: true })
  phoneNumber: string

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  telegramId: string

  @Column({ type: 'varchar', length: 255, default: USER_PROFILE.DEFAULTS.COUNTRY_CODE })
  countryCode: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  subscribtion_id: string

  @OneToOne('Subscribtion', (s: Subscribtion) => s.customer, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'subscribtion_id' })
  subscribtion: Subscribtion

  @OneToMany('Business', (business: Business) => business.customer, { cascade: true })
  businesess: Business[]
}
