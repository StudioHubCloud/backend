import { Column, Entity, JoinColumn, ManyToOne, OneToOne, Unique } from 'typeorm'
import { Mixin } from 'ts-mixer'
import { UuidIdBaseMixin } from '../mixin-entities'
import { USER_PROFILE } from '@app/common'
import type { Client } from './client.entity'
import type { StaffMember } from './staff-member.entity'
import type { Business } from './business.entity'

@Entity({ name: 'user_profile' })
@Unique(['telegram_id', 'business_id'])
@Unique(['phone_number', 'business_id'])
export class UserProfile extends Mixin(UuidIdBaseMixin) {
  @Column({ type: 'varchar', length: 255 })
  full_name: string

  @Column({ type: 'varchar', length: 255 })
  phone_number: string

  @Column({ type: 'varchar', length: 255, unique: true })
  telegram_id: string

  @Column({ type: 'enum', enum: Object.values(USER_PROFILE.ROLE) })
  role: string

  @Column({
    type: 'enum',
    enum: Object.values(USER_PROFILE.STATUS),
    default: USER_PROFILE.DEFAULTS.STATUS,
  })
  status: string

  @ManyToOne('Business', (business: Business) => business.user_profiles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business

  @OneToOne('StaffMember', (staff_member: StaffMember) => staff_member.user_profile, {
    nullable: true,
    onDelete: 'CASCADE',
    cascade: true,
  })
  staff_member: StaffMember

  @OneToOne('Client', (client: Client) => client.user_profile, {
    nullable: true,
    onDelete: 'CASCADE',
    cascade: true,
  })
  client: Client
}
