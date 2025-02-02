import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm'
import { Mixin } from 'ts-mixer'
import { UuidIdBaseMixin } from '../mixin-entities'
import type { Customer } from './customer.entity'
import type { Studio } from './studio.entity'
import type { UserProfile } from './user-profile.entity'

@Entity({ name: 'business' })
export class Business extends Mixin(UuidIdBaseMixin) {
  @Column({ type: 'varchar', length: 255 })
  display_name: string

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  public_email: string

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  phone_number: string

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  website_url: string

  @ManyToOne('Customer', (customer: Customer) => customer.businesess, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer

  @OneToMany('Studio', (studio: Studio) => studio.business, { cascade: true })
  studios: Studio[]

  @OneToMany('UserProfile', (user_profile: UserProfile) => user_profile.business)
  user_profiles: UserProfile[]
}
