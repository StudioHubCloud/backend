import { Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm'
import { Mixin } from 'ts-mixer'
import { UuidIdBaseMixin } from '../mixin-entities'
import type { UserProfile } from './user-profile.entity'
import type { Pass } from './pass.entity'

@Entity({ name: 'client' })
export class Client extends Mixin(UuidIdBaseMixin) {
  @OneToOne('UserProfile', (user_profile: UserProfile) => user_profile.client)
  @JoinColumn({ name: 'user_profile_id' })
  user_profile: UserProfile

  @OneToMany('Pass', (pass: Pass) => pass.client, { cascade: true })
  passes: Pass[]
}
