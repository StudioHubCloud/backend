import { Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm'
import { Mixin } from 'ts-mixer'
import { UuidIdBaseMixin } from '../mixin-entities'
import type { UserProfile } from './user-profile.entity'
import type { Group } from './group.entity'

@Entity({ name: 'staff_member' })
export class StaffMember extends Mixin(UuidIdBaseMixin) {
  @OneToOne('UserProfile', (user_profile: UserProfile) => user_profile.staff_member)
  @JoinColumn({ name: 'user_profile_id' })
  user_profile: UserProfile

  @OneToMany('Group', (group: Group) => group.trainer, { cascade: false })
  groups: Group[]
}
