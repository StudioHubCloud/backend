import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm'
import { Mixin } from 'ts-mixer'
import { UuidIdBaseMixin } from '../mixin-entities'
import type { Business } from './business.entity'
import type { Group } from './group.entity'
import type { GroupStyle } from './group-style.entity'

@Entity({ name: 'studio' })
export class Studio extends Mixin(UuidIdBaseMixin) {
  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string

  @Column({ type: 'varchar', length: 255 })
  street_address_1: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  street_address_2: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  city: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  state: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  country: string

  @ManyToOne('Business', (business: Business) => business.studios)
  @JoinColumn({ name: 'business_id' })
  business: Business

  @OneToMany('Group', (group: Group) => group.studio)
  groups: Group[]

  @OneToMany('GroupStyle', (group_style: GroupStyle) => group_style.studio)
  group_styles: GroupStyle[]
}
